import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

const VAPID_PUBLIC_KEY = "BCXOuJIV8KDJJ8_AZx-TXJb3w_T5Rscg1pzJ2lpyRTH3uFgWodFLS0aWXrzZB4NDQXuovklUsOvaU73eQexuHCo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

type PushConfig = { vapid_private_key: string | null; vapid_subject: string | null } | null;
type RestJob = {
  id: string;
  user_id: string;
  workout_id: string;
  ends_at: string;
  exercise_name: string;
  next_set_number: number | null;
  attempt_count: number;
};
type SubscriptionRow = { endpoint: string; p256dh: string; auth: string };

const supabase = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!supabase) return Response.json({ error: "Push dispatcher is not configured." }, { status: 503 });

  const cronToken = request.headers.get("x-cron-token");
  if (!cronToken || cronToken.length > 256) return new Response("Unauthorized", { status: 401 });

  const { data: configData, error: configError } = await supabase.rpc("get_workout_rest_push_config", {
    p_cron_token: cronToken,
  });
  const config = configData as PushConfig;
  if (configError || !config?.vapid_private_key || !config.vapid_subject) {
    return new Response("Unauthorized", { status: 401 });
  }

  webPush.setVapidDetails(config.vapid_subject, VAPID_PUBLIC_KEY, config.vapid_private_key);
  const { data: jobs, error: jobsError } = await supabase.rpc("claim_due_workout_rest_push_jobs", { p_limit: 25 });
  if (jobsError) {
    console.error("[workout-push] Could not claim due notifications.", jobsError.code);
    return Response.json({ error: "Could not claim notifications." }, { status: 500 });
  }

  let delivered = 0;
  for (const job of (jobs ?? []) as RestJob[]) {
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("workout_push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", job.user_id);

    if (subscriptionsError) {
      await retryOrDelete(job);
      continue;
    }
    if (!subscriptions?.length) {
      await deleteJob(job.id);
      continue;
    }

    const payload = JSON.stringify({
      title: "Descanso concluído",
      body: job.next_set_number
        ? `${job.exercise_name} · Série ${job.next_set_number} pronta`
        : `${job.exercise_name} · pronto para continuar`,
      url: "/treino/sessao",
      tag: `bctrl-rest-${job.id}`,
    });
    const results = await Promise.allSettled(
      (subscriptions as SubscriptionRow[]).map(async (subscription) => {
        try {
          await webPush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            { TTL: 120, urgency: "high" },
          );
          return { endpoint: subscription.endpoint, delivered: true };
        } catch (error) {
          const statusCode = typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("workout_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
            return { endpoint: subscription.endpoint, expired: true };
          }
          console.error("[workout-push] Delivery attempt failed.", statusCode || "network");
          return { endpoint: subscription.endpoint, failed: true };
        }
      }),
    );

    const failed = results.some((result) => result.status === "rejected" || (result.status === "fulfilled" && "failed" in result.value));
    const sent = results.some((result) => result.status === "fulfilled" && "delivered" in result.value);
    if (failed && job.attempt_count < 4) {
      await retryOrDelete(job);
    } else {
      if (sent) delivered += 1;
      await deleteJob(job.id);
    }
  }

  return Response.json({ delivered, checked: jobs?.length ?? 0 });
});

async function retryOrDelete(job: RestJob) {
  if (job.attempt_count >= 4) return deleteJob(job.id);
  const { error } = await supabase!
    .from("workout_rest_push_jobs")
    .update({
      status: "pending",
      attempt_count: job.attempt_count + 1,
      next_attempt_at: new Date(Date.now() + 15_000).toISOString(),
      locked_until: null,
    })
    .eq("id", job.id);
  if (error) console.error("[workout-push] Could not schedule a retry.", error.code);
}

async function deleteJob(id: string) {
  const { error } = await supabase!
    .from("workout_rest_push_jobs")
    .delete()
    .eq("id", id);
  if (error) console.error("[workout-push] Could not remove a completed job.", error.code);
}
