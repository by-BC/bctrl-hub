type View = "front" | "back";

type Region = { muscle: string; d: string };

const FRONT: Region[] = [
  { muscle: "neck", d: "M157 78 Q180 86 203 78 L202 111 Q180 124 158 111Z" },
  { muscle: "shoulders", d: "M119 105 Q98 105 82 119 Q73 134 81 151 Q94 160 110 145 L132 124Z" },
  { muscle: "shoulders", d: "M241 105 Q262 105 278 119 Q287 134 279 151 Q266 160 250 145 L228 124Z" },
  { muscle: "chest", d: "M130 119 Q153 108 177 119 L176 169 Q153 183 126 165 Q118 143 130 119Z" },
  { muscle: "chest", d: "M230 119 Q207 108 183 119 L184 169 Q207 183 234 165 Q242 143 230 119Z" },
  { muscle: "biceps", d: "M82 151 Q96 154 107 145 L96 203 Q88 220 77 215 Q70 209 75 190Z" },
  { muscle: "biceps", d: "M278 151 Q264 154 253 145 L264 203 Q272 220 283 215 Q290 209 285 190Z" },
  { muscle: "forearms", d: "M77 218 Q88 220 96 207 L78 270 Q71 284 62 277 Q54 272 60 256Z" },
  { muscle: "forearms", d: "M283 218 Q272 220 264 207 L282 270 Q289 284 298 277 Q306 272 300 256Z" },
  { muscle: "abdominals", d: "M153 174 Q180 180 207 174 L205 258 Q180 273 155 258Z" },
  { muscle: "quadriceps", d: "M117 306 Q142 304 164 317 L154 407 Q144 430 122 423 Q106 414 105 381Z" },
  { muscle: "quadriceps", d: "M243 306 Q218 304 196 317 L206 407 Q216 430 238 423 Q254 414 255 381Z" },
  { muscle: "abductors", d: "M109 311 Q95 309 88 325 L83 381 Q86 399 102 398 L116 334Z" },
  { muscle: "abductors", d: "M251 311 Q265 309 272 325 L277 381 Q274 399 258 398 L244 334Z" },
  { muscle: "adductors", d: "M164 320 Q177 314 178 328 L173 401 Q169 421 157 416 L145 394Z" },
  { muscle: "adductors", d: "M196 320 Q183 314 182 328 L187 401 Q191 421 203 416 L215 394Z" },
  { muscle: "calves", d: "M119 440 Q135 433 151 443 L144 524 Q140 547 126 545 Q112 543 112 521Z" },
  { muscle: "calves", d: "M241 440 Q225 433 209 443 L216 524 Q220 547 234 545 Q248 543 248 521Z" },
];

const BACK: Region[] = [
  { muscle: "neck", d: "M157 78 Q180 86 203 78 L202 111 Q180 124 158 111Z" },
  { muscle: "shoulders", d: "M119 105 Q98 105 82 119 Q73 134 81 151 Q94 160 110 145 L132 124Z" },
  { muscle: "shoulders", d: "M241 105 Q262 105 278 119 Q287 134 279 151 Q266 160 250 145 L228 124Z" },
  { muscle: "traps", d: "M145 108 Q180 91 215 108 L238 143 L217 184 L180 204 L143 184 L122 143Z" },
  { muscle: "triceps", d: "M82 151 Q96 154 107 145 L96 203 Q88 220 77 215 Q70 209 75 190Z" },
  { muscle: "triceps", d: "M278 151 Q264 154 253 145 L264 203 Q272 220 283 215 Q290 209 285 190Z" },
  { muscle: "forearms", d: "M77 218 Q88 220 96 207 L78 270 Q71 284 62 277 Q54 272 60 256Z" },
  { muscle: "forearms", d: "M283 218 Q272 220 264 207 L282 270 Q289 284 298 277 Q306 272 300 256Z" },
  { muscle: "lats", d: "M124 157 Q144 171 180 196 Q216 171 236 157 L249 235 Q228 272 205 286 L180 301 L155 286 Q132 272 111 235Z" },
  { muscle: "lower_back", d: "M155 218 Q180 231 205 218 L209 291 Q180 309 151 291Z" },
  { muscle: "glutes", d: "M119 294 Q146 284 177 301 L175 359 Q157 376 126 360 Q111 344 119 294Z" },
  { muscle: "glutes", d: "M241 294 Q214 284 183 301 L185 359 Q203 376 234 360 Q249 344 241 294Z" },
  { muscle: "hamstrings", d: "M117 366 Q143 374 172 360 L164 425 Q151 446 125 431 Q108 416 117 366Z" },
  { muscle: "hamstrings", d: "M243 366 Q217 374 188 360 L196 425 Q209 446 235 431 Q252 416 243 366Z" },
  { muscle: "calves", d: "M119 440 Q135 433 151 443 L144 524 Q140 547 126 545 Q112 543 112 521Z" },
  { muscle: "calves", d: "M241 440 Q225 433 209 443 L216 524 Q220 547 234 545 Q248 543 248 521Z" },
];

/** Original SVG muscle figure. Every highlighted region is an independent path. */
export function MuscleFigure({ view, active }: { view: View; active: ReadonlySet<string> }) {
  const regions = view === "front" ? FRONT : BACK;
  const fillFor = (muscle: string) => {
    const selected = active.has(muscle) || active.has("full_body");
    return selected ? "#d96735" : "#85878d";
  };

  return (
    <svg role="img" aria-label={view === "front" ? "Corpo humano, vista frontal" : "Corpo humano, vista posterior"} viewBox="0 0 360 620" className="mx-auto mt-3 h-[590px] w-full max-w-[280px] overflow-visible">
      <title>{view === "front" ? "Mapa muscular frontal" : "Mapa muscular posterior"}</title>
      <g fill="#e9e3d8" fillOpacity=".12" stroke="#e9e3d8" strokeOpacity=".7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="180" cy="42" rx="30" ry="36" />
        <path d="M157 76 Q180 85 203 76 L206 98 Q226 96 245 105 L275 115 Q294 122 300 143 L285 207 Q280 230 266 248 L253 267 L248 292 Q243 307 230 314 L235 362 L253 427 L245 443 L251 527 Q253 547 238 550 L211 550 Q203 546 207 528 L208 451 L198 429 L190 366 L180 355 L170 366 L162 429 L152 451 L153 528 Q157 546 149 550 L122 550 Q107 547 109 527 L115 443 L107 427 L125 362 L130 314 Q117 307 112 292 L107 267 L94 248 Q80 230 75 207 L60 143 Q66 122 85 115 L115 105 Q134 96 154 98Z" />
        <path d="M84 116 Q68 111 57 126 L39 164 Q33 177 36 193 L51 246 Q55 260 65 260 Q74 259 71 247 L62 207 L79 174 L99 145Z" />
        <path d="M276 116 Q292 111 303 126 L321 164 Q327 177 324 193 L309 246 Q305 260 295 260 Q286 259 289 247 L298 207 L281 174 L261 145Z" />
        <path d="M121 548 Q135 541 151 550 L151 565 Q147 576 129 579 L100 581 Q91 579 99 570Z" />
        <path d="M239 548 Q225 541 209 550 L209 565 Q213 576 231 579 L260 581 Q269 579 261 570Z" />
      </g>
      <g stroke="#27292f" strokeOpacity=".9" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {regions.map(({ muscle, d }, index) => {
          const selected = active.has(muscle) || active.has("full_body");
          return <path key={`${muscle}-${index}`} data-muscle-region={muscle} data-active={selected ? "true" : "false"} d={d} fill={fillFor(muscle)} fillOpacity={selected ? ".98" : ".34"} />;
        })}
      </g>
      <g fill="none" stroke="#e9e3d8" strokeOpacity=".38" strokeWidth="2">
        <path d="M180 116v39M180 204v85M180 300v55M180 366v57" />
        <path d="M106 266q-9 18-8 36M254 266q9 18 8 36" />
        <path d="M111 431q-4 6-4 12M249 431q4 6 4 12" />
      </g>
    </svg>
  );
}
