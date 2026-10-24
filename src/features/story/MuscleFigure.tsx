type View = "front" | "back";

type MuscleRegion = { muscle: string; d: string };

const FRONT: MuscleRegion[] = [
  { muscle: "neck", d: "M184 104 C192 112 207 112 216 104 L219 144 Q201 157 181 144Z" },
  { muscle: "shoulders", d: "M158 139 C141 132 124 137 116 153 C108 168 116 191 132 198 C145 197 156 181 166 163Z" },
  { muscle: "shoulders", d: "M242 139 C259 132 276 137 284 153 C292 168 284 191 268 198 C255 197 244 181 234 163Z" },
  { muscle: "chest", d: "M169 153 C182 145 196 148 199 163 L197 211 C184 219 163 214 151 200 C151 179 157 163 169 153Z" },
  { muscle: "chest", d: "M231 153 C218 145 204 148 201 163 L203 211 C216 219 237 214 249 200 C249 179 243 163 231 153Z" },
  { muscle: "biceps", d: "M124 196 C137 199 148 191 158 180 C156 202 149 224 142 244 C137 255 124 256 119 245 C114 231 116 212 124 196Z" },
  { muscle: "biceps", d: "M276 196 C263 199 252 191 242 180 C244 202 251 224 258 244 C263 255 276 256 281 245 C286 231 284 212 276 196Z" },
  { muscle: "forearms", d: "M119 254 C129 258 138 254 143 244 C141 273 132 301 121 328 C117 339 103 339 99 328 C96 312 104 278 119 254Z" },
  { muscle: "forearms", d: "M281 254 C271 258 262 254 257 244 C259 273 268 301 279 328 C283 339 297 339 301 328 C304 312 296 278 281 254Z" },
  { muscle: "abdominals", d: "M178 218 C190 222 198 222 200 222 C202 222 210 222 222 218 L220 307 C207 319 193 319 180 307Z" },
  { muscle: "abductors", d: "M157 305 C168 309 180 313 195 314 L190 363 C178 371 165 368 151 354 C145 344 148 323 157 305Z" },
  { muscle: "abductors", d: "M243 305 C232 309 220 313 205 314 L210 363 C222 371 235 368 249 354 C255 344 252 323 243 305Z" },
  { muscle: "adductors", d: "M195 316 C201 313 207 313 213 316 L209 374 C207 389 199 396 191 388 C184 379 187 345 195 316Z" },
  { muscle: "adductors", d: "M205 316 C199 313 193 313 187 316 L191 374 C193 389 201 396 209 388 C216 379 213 345 205 316Z" },
  { muscle: "quadriceps", d: "M151 358 C165 371 180 372 194 365 L188 454 C184 473 172 482 156 475 C141 464 137 418 151 358Z" },
  { muscle: "quadriceps", d: "M249 358 C235 371 220 372 206 365 L212 454 C216 473 228 482 244 475 C259 464 263 418 249 358Z" },
  { muscle: "calves", d: "M154 491 C166 482 179 486 187 495 L184 571 C181 589 171 597 160 589 C149 579 146 523 154 491Z" },
  { muscle: "calves", d: "M246 491 C234 482 221 486 213 495 L216 571 C219 589 229 597 240 589 C251 579 254 523 246 491Z" },
];

const BACK: MuscleRegion[] = [
  { muscle: "neck", d: "M184 104 C192 112 207 112 216 104 L219 144 Q201 157 181 144Z" },
  { muscle: "shoulders", d: "M158 139 C141 132 124 137 116 153 C108 168 116 191 132 198 C145 197 156 181 166 163Z" },
  { muscle: "shoulders", d: "M242 139 C259 132 276 137 284 153 C292 168 284 191 268 198 C255 197 244 181 234 163Z" },
  { muscle: "traps", d: "M174 139 C183 129 193 125 200 125 C207 125 217 129 226 139 L252 177 L226 211 L200 222 L174 211 L148 177Z" },
  { muscle: "triceps", d: "M124 196 C137 199 148 191 158 180 C156 202 149 224 142 244 C137 255 124 256 119 245 C114 231 116 212 124 196Z" },
  { muscle: "triceps", d: "M276 196 C263 199 252 191 242 180 C244 202 251 224 258 244 C263 255 276 256 281 245 C286 231 284 212 276 196Z" },
  { muscle: "forearms", d: "M119 254 C129 258 138 254 143 244 C141 273 132 301 121 328 C117 339 103 339 99 328 C96 312 104 278 119 254Z" },
  { muscle: "forearms", d: "M281 254 C271 258 262 254 257 244 C259 273 268 301 279 328 C283 339 297 339 301 328 C304 312 296 278 281 254Z" },
  { muscle: "lats", d: "M151 183 C164 196 181 207 198 214 L194 302 C180 310 163 313 149 303 C137 285 133 236 151 183Z" },
  { muscle: "lats", d: "M249 183 C236 196 219 207 202 214 L206 302 C220 310 237 313 251 303 C263 285 267 236 249 183Z" },
  { muscle: "lower_back", d: "M194 222 C198 225 202 225 206 222 L212 309 C205 317 195 317 188 309Z" },
  { muscle: "glutes", d: "M153 309 C166 301 183 304 198 314 L195 362 C185 373 169 376 155 364 C146 352 146 326 153 309Z" },
  { muscle: "glutes", d: "M247 309 C234 301 217 304 202 314 L205 362 C215 373 231 376 245 364 C254 352 254 326 247 309Z" },
  { muscle: "hamstrings", d: "M153 369 C165 378 180 378 194 369 L188 462 C182 480 169 484 157 474 C146 461 143 413 153 369Z" },
  { muscle: "hamstrings", d: "M247 369 C235 378 220 378 206 369 L212 462 C218 480 231 484 243 474 C254 461 257 413 247 369Z" },
  { muscle: "calves", d: "M154 491 C166 482 179 486 187 495 L184 571 C181 589 171 597 160 589 C149 579 146 523 154 491Z" },
  { muscle: "calves", d: "M246 491 C234 482 221 486 213 495 L216 571 C219 589 229 597 240 589 C251 579 254 523 246 491Z" },
];

const BODY = (
  <>
    <path d="M183 57 C183 32 194 19 201 19 C217 19 226 34 224 57 C223 81 214 101 202 105 C190 101 182 81 183 57Z" />
    <path d="M181 105 Q201 115 221 105 L224 137 Q249 131 271 146 C292 160 301 190 292 217 L278 261 Q273 281 261 299 L255 326 Q250 343 237 350 L248 386 L260 452 L250 487 L251 568 Q252 596 236 598 L218 598 Q207 595 210 576 L209 498 L198 465 L194 404 L201 383 L201 370 L199 353 L197 370 L199 383 L206 404 L202 465 L191 498 L190 576 Q193 595 182 598 L164 598 Q148 596 149 568 L150 487 L140 452 L152 386 L163 350 Q150 343 145 326 L139 299 Q127 281 122 261 L108 217 Q99 190 110 160 C121 146 143 131 168 137Z" />
    <path d="M113 162 C101 156 90 161 83 174 L62 221 Q56 235 63 252 L88 322 Q94 338 105 333 Q115 328 110 313 L92 250 L111 216 L130 193Z" />
    <path d="M289 162 C301 156 312 161 319 174 L340 221 Q346 235 339 252 L314 322 Q308 338 297 333 Q287 328 292 313 L310 250 L291 216 L272 193Z" />
    <path d="M163 594 Q177 589 190 598 L190 609 Q184 619 163 621 L133 619 Q124 616 134 608Z" />
    <path d="M239 594 Q225 589 212 598 L212 609 Q218 619 239 621 L269 619 Q278 616 268 608Z" />
  </>
);

/** Vector muscle map with a continuous human silhouette and individually highlighted regions. */
export function MuscleFigure({ view, active }: { view: View; active: ReadonlySet<string> }) {
  const regions = view === "front" ? FRONT : BACK;
  const prefix = `muscle-${view}`;

  return (
    <svg role="img" aria-label={view === "front" ? "Corpo humano, vista frontal" : "Corpo humano, vista posterior"} viewBox="45 0 310 630" className="mx-auto mt-2 h-[850px] w-full max-w-[460px] overflow-visible">
      <title>{view === "front" ? "Mapa muscular frontal" : "Mapa muscular posterior"}</title>
      <defs>
        <linearGradient id={`${prefix}-skin`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#555860" />
          <stop offset=".52" stopColor="#34363d" />
          <stop offset="1" stopColor="#24262c" />
        </linearGradient>
        <linearGradient id={`${prefix}-rest`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#858890" />
          <stop offset="1" stopColor="#555861" />
        </linearGradient>
        <linearGradient id={`${prefix}-active`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ff9b62" />
          <stop offset=".55" stopColor="#f06e3d" />
          <stop offset="1" stopColor="#c94b28" />
        </linearGradient>
        <filter id={`${prefix}-glow`} x="-40%" y="-20%" width="180%" height="150%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g fill={`url(#${prefix}-skin)`} stroke="#b9bbc0" strokeOpacity=".76" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {BODY}
      </g>
      <g stroke="#202127" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {regions.map(({ muscle, d }, index) => {
          const selected = active.has(muscle) || active.has("full_body");
          return <path key={`${muscle}-${index}`} data-muscle-region={muscle} data-active={selected ? "true" : "false"} d={d} fill={`url(#${prefix}-${selected ? "active" : "rest"})`} fillOpacity={selected ? ".98" : ".74"} filter={selected ? `url(#${prefix}-glow)` : undefined} />;
        })}
      </g>
      <g fill="none" stroke="#d7d8da" strokeOpacity=".4" strokeWidth="1.6" strokeLinecap="round">
        {view === "front" ? <>
          <path d="M165 151 Q181 160 198 163 M235 151 Q219 160 202 163" />
          <path d="M200 220 V304 M182 229 Q181 266 183 302 M218 229 Q219 266 217 302" />
          <path d="M152 396 Q168 407 188 398 M248 396 Q232 407 212 398" />
          <path d="M164 462 Q173 468 186 462 M236 462 Q227 468 214 462" />
        </> : <>
          <path d="M150 176 Q173 188 196 203 M250 176 Q227 188 204 203" />
          <path d="M185 226 Q180 265 184 303 M215 226 Q220 265 216 303" />
          <path d="M157 373 Q173 383 191 373 M243 373 Q227 383 209 373" />
          <path d="M163 465 Q174 470 185 465 M237 465 Q226 470 215 465" />
        </>}
        <path d="M151 337 Q171 349 196 350 M249 337 Q229 349 204 350" />
        <path d="M152 488 Q169 497 186 491 M248 488 Q231 497 214 491" />
      </g>
      <g fill="none" stroke="#d7d8da" strokeOpacity=".22" strokeWidth="1">
        <path d="M102 257 Q98 280 108 300 M298 257 Q302 280 292 300" />
        <path d="M150 570 Q169 579 189 573 M250 570 Q231 579 211 573" />
      </g>
    </svg>
  );
}
