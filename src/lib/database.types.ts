
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "body_weights": {
                  Row: {
                    "created_at": string,"day": string,"id": string,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"id"?: string,"user_id"?: string,"weight_kg": number
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"id"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                },"exercises": {
                  Row: {
                    "created_at": string,"equipment": string | null,"exercise_type": string,"hevy_template_id": string | null,"id": string,"instructions": string | null,"media_url": string | null,"muscle_group": string | null,"name": string,"notes": string | null,"secondary_muscles": (string)[],"source": string,"thumbnail_url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"equipment"?: string | null,"exercise_type"?: string,"hevy_template_id"?: string | null,"id"?: string,"instructions"?: string | null,"media_url"?: string | null,"muscle_group"?: string | null,"name": string,"notes"?: string | null,"secondary_muscles"?: (string)[],"source"?: string,"thumbnail_url"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"equipment"?: string | null,"exercise_type"?: string,"hevy_template_id"?: string | null,"id"?: string,"instructions"?: string | null,"media_url"?: string | null,"muscle_group"?: string | null,"name"?: string,"notes"?: string | null,"secondary_muscles"?: (string)[],"source"?: string,"thumbnail_url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"foods": {
                  Row: {
                    "carbs_g": number,"category": string | null,"created_at": string,"fat_g": number,"id": string,"kcal": number,"name": string,"protein_g": number,"taco_id": number | null,"unit_grams": NonNullable<Json>,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g": number,"category"?: string | null,"created_at"?: string,"fat_g": number,"id"?: string,"kcal": number,"name": string,"protein_g": number,"taco_id"?: number | null,"unit_grams"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "carbs_g"?: number,"category"?: string | null,"created_at"?: string,"fat_g"?: number,"id"?: string,"kcal"?: number,"name"?: string,"protein_g"?: number,"taco_id"?: number | null,"unit_grams"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"habit_logs": {
                  Row: {
                    "cardio_type": string | null,"created_at": string,"day": string,"distance_km": number | null,"habit_id": string,"id": string,"kcal": number | null,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cardio_type"?: string | null,"created_at"?: string,"day": string,"distance_km"?: number | null,"habit_id": string,"id"?: string,"kcal"?: number | null,"user_id"?: string,"value"?: number
                  }
                  Update: {
                    "cardio_type"?: string | null,"created_at"?: string,"day"?: string,"distance_km"?: number | null,"habit_id"?: string,"id"?: string,"kcal"?: number | null,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_logs_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"kind": string,"name": string,"period": string,"system_key": string | null,"target": number,"unit": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"name": string,"period": string,"system_key"?: string | null,"target": number,"unit"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"period"?: string,"system_key"?: string | null,"target"?: number,"unit"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_log_items": {
                  Row: {
                    "carbs_g": number,"created_at": string,"fat_g": number,"food_id": string | null,"grams": number,"id": string,"kcal": number,"meal_log_id": string,"name": string,"protein_g": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g": number,"created_at"?: string,"fat_g": number,"food_id"?: string | null,"grams": number,"id"?: string,"kcal": number,"meal_log_id": string,"name": string,"protein_g": number,"user_id"?: string
                  }
                  Update: {
                    "carbs_g"?: number,"created_at"?: string,"fat_g"?: number,"food_id"?: string | null,"grams"?: number,"id"?: string,"kcal"?: number,"meal_log_id"?: string,"name"?: string,"protein_g"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_log_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_log_items_meal_log_id_user_id_fkey"
      columns: ["meal_log_id","user_id"]
isOneToOne: false
      referencedRelation: "meal_logs"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"meal_logs": {
                  Row: {
                    "created_at": string,"day": string,"id": string,"meal_id": string,"note": string | null,"off_plan": boolean,"option_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"id"?: string,"meal_id": string,"note"?: string | null,"off_plan"?: boolean,"option_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"id"?: string,"meal_id"?: string,"note"?: string | null,"off_plan"?: boolean,"option_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_logs_meal_id_user_id_fkey"
      columns: ["meal_id","user_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "meal_logs_option_id_meal_id_user_id_fkey"
      columns: ["option_id","meal_id","user_id"]
isOneToOne: false
      referencedRelation: "meal_options"
      referencedColumns: ["id","meal_id","user_id"]
    }
                  ]
                },"meal_options": {
                  Row: {
                    "created_at": string,"id": string,"items": NonNullable<Json>,"meal_id": string,"position": number,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"meal_id": string,"position"?: number,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"meal_id"?: string,"position"?: number,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_options_meal_id_user_id_fkey"
      columns: ["meal_id","user_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"meals": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"time": string | null,"training_day_only": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position"?: number,"time"?: string | null,"training_day_only"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"time"?: string | null,"training_day_only"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "activity_level": string | null,"birth_date": string | null,"created_at": string,"display_name": string | null,"goal": string | null,"goal_overrides": NonNullable<Json>,"height_cm": number | null,"protein_g_per_kg": number,"sex": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level"?: string | null,"birth_date"?: string | null,"created_at"?: string,"display_name"?: string | null,"goal"?: string | null,"goal_overrides"?: NonNullable<Json>,"height_cm"?: number | null,"protein_g_per_kg"?: number,"sex"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "activity_level"?: string | null,"birth_date"?: string | null,"created_at"?: string,"display_name"?: string | null,"goal"?: string | null,"goal_overrides"?: NonNullable<Json>,"height_cm"?: number | null,"protein_g_per_kg"?: number,"sex"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"routine_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"notes": string | null,"position": number,"rest_sec": number | null,"routine_id": string,"sets": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id"?: string,"notes"?: string | null,"position"?: number,"rest_sec"?: number | null,"routine_id": string,"sets"?: number,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"rest_sec"?: number | null,"routine_id"?: string,"sets"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "routine_exercises_exercise_id_user_id_fkey"
      columns: ["exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "routine_exercises_routine_id_user_id_fkey"
      columns: ["routine_id","user_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"routines": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"notes": string | null,"position": number,"rest_sec": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"position"?: number,"rest_sec"?: number,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"position"?: number,"rest_sec"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tasks": {
                  Row: {
                    "created_at": string,"done_at": string | null,"id": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done_at"?: string | null,"id"?: string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"done_at"?: string | null,"id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workout_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"notes": string | null,"position": number,"user_id": string,"workout_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id"?: string,"notes"?: string | null,"position"?: number,"user_id"?: string,"workout_id": string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"user_id"?: string,"workout_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_exercises_exercise_id_user_id_fkey"
      columns: ["exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "workout_exercises_workout_id_user_id_fkey"
      columns: ["workout_id","user_id"]
isOneToOne: false
      referencedRelation: "v_exercise_session_stats"
      referencedColumns: ["workout_id","user_id"]
    },{
      foreignKeyName: "workout_exercises_workout_id_user_id_fkey"
      columns: ["workout_id","user_id"]
isOneToOne: false
      referencedRelation: "workouts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"workout_sets": {
                  Row: {
                    "created_at": string,"distance_m": number | null,"duration_s": number | null,"id": string,"position": number,"pr_kinds": (string)[],"reps": number | null,"set_type": string,"user_id": string,"weight_kg": number | null,"workout_exercise_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"distance_m"?: number | null,"duration_s"?: number | null,"id"?: string,"position"?: number,"pr_kinds"?: (string)[],"reps"?: number | null,"set_type"?: string,"user_id"?: string,"weight_kg"?: number | null,"workout_exercise_id": string
                  }
                  Update: {
                    "created_at"?: string,"distance_m"?: number | null,"duration_s"?: number | null,"id"?: string,"position"?: number,"pr_kinds"?: (string)[],"reps"?: number | null,"set_type"?: string,"user_id"?: string,"weight_kg"?: number | null,"workout_exercise_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sets_workout_exercise_id_user_id_fkey"
      columns: ["workout_exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "v_exercise_last_sets"
      referencedColumns: ["workout_exercise_id","user_id"]
    },{
      foreignKeyName: "workout_sets_workout_exercise_id_user_id_fkey"
      columns: ["workout_exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "workout_exercises"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"workouts": {
                  Row: {
                    "created_at": string,"day": string,"finished_at": string | null,"hevy_workout_id": string | null,"id": string,"notes": string | null,"routine_id": string | null,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"finished_at"?: string | null,"hevy_workout_id"?: string | null,"id"?: string,"notes"?: string | null,"routine_id"?: string | null,"source"?: string,"started_at": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"finished_at"?: string | null,"hevy_workout_id"?: string | null,"id"?: string,"notes"?: string | null,"routine_id"?: string | null,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workouts_routine_id_user_id_fkey"
      columns: ["routine_id","user_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            "v_exercise_bests": {
                  Row: {
                    "exercise_id": string | null,"max_distance_m": number | null,"max_duration_s": number | null,"max_e1rm": number | null,"max_set_volume": number | null,"max_weight": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "workout_exercises_exercise_id_user_id_fkey"
      columns: ["exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"v_exercise_last_sets": {
                  Row: {
                    "day": string | null,"distance_m": number | null,"duration_s": number | null,"exercise_id": string | null,"position": number | null,"reps": number | null,"started_at": string | null,"user_id": string | null,"weight_kg": number | null,"workout_exercise_id": string | null,"workout_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "workout_exercises_exercise_id_user_id_fkey"
      columns: ["exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"v_exercise_session_stats": {
                  Row: {
                    "best_distance_m": number | null,"best_duration_s": number | null,"best_e1rm": number | null,"best_weight": number | null,"day": string | null,"exercise_id": string | null,"sets": number | null,"started_at": string | null,"total_distance_m": number | null,"total_duration_s": number | null,"user_id": string | null,"volume": number | null,"workout_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "daily_scores":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "best_session_kg": number,"day": string,"diet": boolean,"habits": boolean,"meals_done": number,"meals_planned": number,"prs": number,"score": number,"tasks": boolean,"trained": boolean,"volume_kg": number,"workouts": number
            }[]
                           },
"finish_workout":
{ Args: { "payload": Json }; Returns: string
                           },
"month_summary":
{ Args: { "p_month": string }; Returns: Json
                           },
"week_summary":
{ Args: { "p_week_start": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
