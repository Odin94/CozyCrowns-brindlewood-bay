import { useId } from "react";
import "./scenery-artwork.css";

type Scenery = "harbor" | "teaGarden" | "midnightMeeting" | "moonlitPier";
type Paint = (name: string) => string;

/** Quiet skies leave room for the club; the story lives around the edges of the table. */
export function SceneryArtwork({ scenery }: { scenery: Scenery }) {
  const id = useId().replace(/:/g, "");
  const paint: Paint = (name) => `url(#${id}-${name})`;
  return (
    <div className={`club-illustration club-illustration--${scenery}`} aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <linearGradient id={`${id}-harbor-sky`} x2="0" y2="1">
            <stop stopColor="#584268" />
            <stop offset=".5" stopColor="#88617e" />
            <stop offset=".82" stopColor="#c08c91" />
            <stop offset="1" stopColor="#dca49a" />
          </linearGradient>
          <linearGradient id={`${id}-garden-sky`} x2="0" y2="1">
            <stop stopColor="#594765" />
            <stop offset=".68" stopColor="#907d98" />
            <stop offset="1" stopColor="#b6aaa6" />
          </linearGradient>
          <linearGradient id={`${id}-night-sky`} x2="0" y2="1">
            <stop stopColor="#292039" />
            <stop offset=".7" stopColor="#514264" />
            <stop offset="1" stopColor="#83728d" />
          </linearGradient>
          <linearGradient id={`${id}-sea`} x2="0" y2="1">
            <stop stopColor="#8a849c" />
            <stop offset=".45" stopColor="#615d7f" />
            <stop offset="1" stopColor="#302f49" />
          </linearGradient>
          <linearGradient id={`${id}-night-sea`} x2="0" y2="1">
            <stop stopColor="#616982" />
            <stop offset=".5" stopColor="#394660" />
            <stop offset="1" stopColor="#223446" />
          </linearGradient>
          <linearGradient id={`${id}-stone`} x2="0" y2="1">
            <stop stopColor="#665574" />
            <stop offset="1" stopColor="#302b40" />
          </linearGradient>
          <linearGradient id={`${id}-wood`} x2="0" y2="1">
            <stop stopColor="#80616c" />
            <stop offset="1" stopColor="#3f3046" />
          </linearGradient>
          <linearGradient id={`${id}-room`} x2="0" y2="1">
            <stop stopColor="#554061" />
            <stop offset=".66" stopColor="#45334f" />
            <stop offset="1" stopColor="#271f34" />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop stopColor="#ffe2ab" stopOpacity=".45" />
            <stop offset=".45" stopColor="#edbf96" stopOpacity=".12" />
            <stop offset="1" stopColor="#edbf96" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-moon-glow`}>
            <stop stopColor="#ece0ec" stopOpacity=".25" />
            <stop offset="1" stopColor="#ece0ec" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-shade`} x2="0" y2="1">
            <stop stopColor="#24182d" stopOpacity=".22" />
            <stop offset=".5" stopColor="#24182d" stopOpacity="0" />
            <stop offset="1" stopColor="#161321" stopOpacity=".18" />
          </linearGradient>
          <pattern id={`${id}-paper`} width="81" height="67" patternUnits="userSpaceOnUse">
            <path
              d="M7 11h1m28 17h1m35-20h1M15 49h1m42 11h1"
              stroke="#f4d9e6"
              strokeWidth="1"
              opacity=".13"
            />
            <path d="M14 23h2m39 20h2m20 19h1" stroke="#24182d" strokeWidth="1" opacity=".13" />
          </pattern>
        </defs>
        {scenery === "harbor" && <Harbor paint={paint} />}
        {scenery === "teaGarden" && <TeaGarden paint={paint} />}
        {scenery === "midnightMeeting" && <MidnightMeeting paint={paint} />}
        {scenery === "moonlitPier" && <MoonlitPier paint={paint} />}
        <rect width="1600" height="1000" fill={paint("paper")} />
        <rect width="1600" height="1000" fill={paint("shade")} />
      </svg>
    </div>
  );
}

function Stars({ muted = false }: { muted?: boolean }) {
  return (
    <g fill="#f0dce6" opacity={muted ? ".27" : ".56"}>
      {[
        [154, 92],
        [338, 165],
        [487, 81],
        [642, 185],
        [1009, 127],
        [1123, 81],
        [1305, 180],
        [1455, 98],
        [1407, 339],
        [165, 340],
        [920, 260],
        [448, 306],
      ].map(([x, y], index) => (
        <circle key={x} cx={x} cy={y} r={index % 3 === 0 ? "1.7" : "1"} />
      ))}
      <path d="M1267 280v12m-6-6h12M263 216v8m-4-4h8" stroke="#f0dce6" strokeWidth="1" />
    </g>
  );
}

function Water({ paint, night = false }: { paint: Paint; night?: boolean }) {
  return (
    <g>
      <path
        d="M0 672Q210 651 400 674T800 674T1200 674T1600 674V1000H0Z"
        fill={paint(night ? "night-sea" : "sea")}
      />
      <g fill="none" stroke={night ? "#a9bdd0" : "#d7b2bc"} strokeLinecap="round">
        {Array.from({ length: 15 }, (_, index) => {
          const y = 704 + index * 18;
          const x = ((index * 173) % 530) - 60;
          return (
            <path
              key={index}
              d={`M${x} ${y}q80 -5 168 0m38 0q62 5 146 0m95 0q84 -5 165 0m85 0q107 6 189 0m99 0q84 -5 178 0`}
              opacity={index % 3 === 0 ? ".22" : ".1"}
              strokeWidth={index > 8 ? "2" : "1.2"}
            />
          );
        })}
      </g>
    </g>
  );
}

function Lantern({
  x,
  y,
  paint,
  small = false,
}: {
  x: number;
  y: number;
  paint: Paint;
  small?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${small ? ".65" : "1"})`}>
      <circle cy="13" r="64" fill={paint("glow")} />
      <path d="M-7-14q0-14 7-14t7 14" fill="none" stroke="#322838" strokeWidth="3" />
      <path d="M-14-14h28l-3 40h-22Z" fill="#edbf8f" />
      <path d="M-15-14h30M-12 26h24M-8-13l2 39M8-13 6 26" stroke="#3f3046" strokeWidth="4" />
      <path d="M0-5v20" stroke="#ffe7b4" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Cottage({
  x,
  y,
  width,
  height,
  color,
  roof = "#413344",
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  roof?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0h${width}v${height}H0Z`} fill={color} />
      <path d={`M-10 4 ${width / 2} -${width * 0.35} ${width + 10} 4Z`} fill={roof} />
      <path
        d={`M${width * 0.73} -${width * 0.28}v-${height * 0.18}h14v${height * 0.24}`}
        fill={roof}
      />
      <g stroke="#d0a7ab" opacity=".15" strokeWidth="1">
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M3 ${16 + i * 17}h${width - 6}`} />
        ))}
      </g>
      <g fill="#e9bb86" opacity=".8" stroke="#554352" strokeWidth="3">
        <rect x={width * 0.14} y="20" width={width * 0.2} height="26" rx="2" />
        <rect x={width * 0.64} y="20" width={width * 0.2} height="26" rx="2" />
        {height > 105 && <rect x={width * 0.14} y="64" width={width * 0.2} height="23" rx="2" />}
      </g>
      <path
        d={`M${width * 0.24} 20v26M${width * 0.74} 20v26M${width * 0.14} 33h${width * 0.2}M${width * 0.64} 33h${width * 0.2}`}
        stroke="#665061"
        strokeWidth="2"
      />
      <path
        d={`M${width * 0.42} ${height}v-43q${width * 0.12} -10 ${width * 0.24} 0v43`}
        fill="#3b3040"
      />
      <circle cx={width * 0.61} cy={height - 17} r="1.5" fill="#d9b48a" />
    </g>
  );
}

function Harbor({ paint }: { paint: Paint }) {
  return (
    <>
      <rect width="1600" height="1000" fill={paint("harbor-sky")} />
      <circle cx="1245" cy="545" r="218" fill={paint("glow")} />
      <circle cx="1245" cy="545" r="65" fill="#f0c3a2" opacity=".75" />
      <g fill="none" stroke="#d3b0c3" strokeLinecap="round" opacity=".16">
        <path
          d="M1020 395q130-20 260 0m-119 18q165-13 315 0M85 318q170-16 290 0m-272 12h160"
          strokeWidth="3"
        />
        <path d="M1030 547h290m-256 21h270" strokeWidth="7" />
      </g>
      <path
        d="M0 641q123-78 267-19t251 11q116-64 279-18t307 22q126-94 261-22t235 10v110H0Z"
        fill="#6f5a79"
        opacity=".7"
      />
      <path d="M0 680q147-66 324-5t301 2q219-44 393 6t337-2q119-44 245-5v81H0Z" fill="#594a67" />
      <Water paint={paint} />
      <g opacity=".34" fill="#e1b2ab">
        <path d="m1215 690 73 0 17 4h-100Zm-26 19h118l21 5h-163Zm-35 20h172l12 6h-190Zm-21 23h228l20 6h-264Z" />
      </g>
      <g className="club-illustration-village">
        <path d="M0 806q121-41 305-2l227 30-36 91L0 949Z" fill={paint("stone")} />
        <Cottage x={-12} y={652} width={138} height={164} color="#806071" />
        <Cottage x={136} y={690} width={89} height={127} color="#aa8182" />
        <Cottage x={241} y={718} width={108} height={113} color="#70566d" />
        <Cottage x={363} y={758} width={92} height={85} color="#987c83" />
        <path d="M49 654v-32h34v32M38 622h58" stroke="#cfacb1" strokeWidth="4" opacity=".5" />
        <path d="M0 833q138-31 289-2l204 29" stroke="#b69aa6" strokeWidth="7" fill="none" />
        <path
          d="M7 861q132-17 281 6m-290 21q170-14 350 24"
          stroke="#bda2ae"
          strokeWidth="2"
          opacity=".15"
          fill="none"
        />
        <g fill="#322b40">
          <rect x="130" y="823" width="10" height="67" rx="3" />
          <rect x="260" y="841" width="10" height="70" rx="3" />
          <rect x="389" y="862" width="10" height="66" rx="3" />
        </g>
        <path d="M135 836q60 37 130 15t130 21" fill="none" stroke="#d2ab99" strokeWidth="3" />
      </g>
      <g transform="translate(829 832)">
        <g fill="#302e48" opacity=".36">
          <path d="M-92 34q89 6 178 0l-8 6q-75 5-161 0Z" />
          <path d="M-83 45q73-5 149 0l12 4q-80 5-145 0Z" />
          <path d="M-64 57q62-4 118 0l-8 4h-97Z" opacity=".7" />
          <path d="M-40 69q42-3 71 0l8 3h-69Z" opacity=".4" />
        </g>
        <path d="M-131 1q139 15 250-3l-31 35q-90 11-186-2Z" fill="#49384c" />
        <path d="M-131 1q139 15 250-3" stroke="#cf9e97" strokeWidth="5" fill="none" />
        <path d="M-25-46h69v46h-69Z" fill="#9f7b86" />
        <path d="M-34-46h86l-8-10h-68Z" fill="#4c3b50" />
        <rect x="-14" y="-37" width="20" height="20" rx="1" fill="#e3bc91" />
        <rect x="18" y="-37" width="17" height="20" rx="1" fill="#605570" />
        <path
          d="M-55-145V3m0-147 131 119m-131-95-57 123"
          fill="none"
          stroke="#3e344b"
          strokeWidth="3"
        />
        <path d="M-52-137 61-39H-52Z" fill="#d6bec5" opacity=".57" />
        <path d="M-55-123-100-34h45Z" fill="#b69eaf" opacity=".62" />
        <path d="M-52-142q25-15 45 0l-9 6-35 1" fill="#d5a2a9" />
        <circle cx="88" cy="8" r="12" fill="none" stroke="#b28588" strokeWidth="4" />
        <g fill="none" strokeLinecap="round">
          <path
            d="M-121 32q31-3 62 3t66 0q47-4 82 0m-231 0h13m152 0h25"
            stroke="#ad9aad"
            strokeWidth="2"
            opacity=".48"
          />
          <path
            d="M-153 45q34-4 61 0m137 3q37-3 75 0m-197 15q21-2 37 0m56 0h33"
            stroke="#b7a1b3"
            strokeWidth="1.5"
            opacity=".24"
          />
        </g>
      </g>
      <path
        d="M1310 746h290v16h-290m32 16v101m93-101v101m103-101v101"
        stroke="#3f334b"
        strokeWidth="12"
        fill="none"
      />
      <Cottage x={1358} y={649} width={177} height={103} color="#846679" />
      <path d="M1354 690h188v15h-188Z" fill="#a28594" />
      <g fill="none" stroke="#41354d" strokeWidth="2.5" strokeLinecap="round" opacity=".8">
        <path d="M974 556q7-8 14 0q7-8 14 0m-502 23q6-6 12 0q6-6 12 0m584-105q8-8 16 0q8-8 16 0" />
      </g>
      <ForegroundReeds />
    </>
  );
}

function Foliage({
  x,
  y,
  scale = 1,
  color = "#374b4b",
}: {
  x: number;
  y: number;
  scale?: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 85Q4 27-17-18M1 69q26-42 39-45M0 42q-33-26-50-25"
        fill="none"
        stroke={color}
        strokeWidth="5"
      />
      <g fill={color}>
        <path d="M-10 16q-36-5-31-33 27-8 31 33M-3 40q-38 5-43-18 23-16 43 18M7 57q4-38 32-33 8 26-32 33M-1 76q-31 3-35-17 22-13 35 17M9 21q-5-32 19-38 17 18-19 38" />
      </g>
      <path
        d="m-28-8 15 19m-21 16 28 11m36-6L12 52"
        stroke="#96a59a"
        strokeWidth="1"
        opacity=".3"
      />
    </g>
  );
}

function TeaGarden({ paint }: { paint: Paint }) {
  return (
    <>
      <rect width="1600" height="1000" fill={paint("garden-sky")} />
      <circle cx="300" cy="220" r="160" fill={paint("moon-glow")} />
      <circle cx="300" cy="220" r="41" fill="#e5d6dc" opacity=".65" />
      <Stars muted />
      <path
        d="M0 681q100-171 229-36 109-162 233-33 127-149 293 29 141-118 288-27 128-115 247 19 165-152 310 45v322H0Z"
        fill="#677575"
        opacity=".42"
      />
      <path
        d="M0 751q129-126 294-19 108-75 226-12 141-64 293 20 190-94 305-29 160-101 290 9 104-75 192-6v286H0Z"
        fill="#435e59"
      />
      <path d="M0 837q263-39 509 12t539-8q229-32 552 23v136H0Z" fill={paint("stone")} />
      <path d="M601 850q119-32 344-2l203 152H420Z" fill="#9c8894" opacity=".21" />
      <g stroke="#b6a2aa" opacity=".16" fill="none">
        <path d="M400 943h773M290 981h1040M540 888h479M552 1000l98-132M984 1000 893 868M752 1000V870" />
      </g>
      <g fill="none" stroke="#473e50">
        <path d="M67 863V466q0-176 158-176t158 176v397" strokeWidth="15" />
        <path d="M82 863V466q0-160 143-160t143 160v397" strokeWidth="3" opacity=".6" />
        <path
          d="M68 517h316M68 586h316M68 655h316M126 352v503M193 308v553M260 314v544M327 365v491"
          strokeWidth="4"
          opacity=".45"
        />
        <path d="M1214 867V460q0-140 136-140t136 140v423" strokeWidth="12" />
        <path
          d="M1214 580h273M1214 646h273M1282 347v497M1350 326v535M1418 350v501"
          strokeWidth="4"
          opacity=".4"
        />
      </g>
      <g fill="#46594f">
        <path d="M0 316q88-63 157-29 115-85 203 20 91-9 131 60-93 35-165-4-96 54-147-4-91 67-179 26Z" />
        <path d="M1184 387q-8-55 78-72 85-57 150 4 114-42 188 20v78q-102 25-191-21-141 48-225-9Z" />
      </g>
      <g fill="#a492ba">
        {Array.from({ length: 18 }, (_, i) => {
          const x = 55 + i * 21;
          const y = 314 + (i % 4) * 13;
          return (
            <g key={i} opacity={i % 3 === 0 ? ".72" : ".5"}>
              <path d={`M${x} ${y}q-16 27 0 ${55 + (i % 3) * 15}q17-32 0-${55 + (i % 3) * 15}Z`} />
              <path
                d={`M${x - 6} ${y + 11}h13m-14 11h13m-10 12h9`}
                stroke="#c4b3d5"
                strokeWidth="3"
              />
            </g>
          );
        })}
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={`M${1260 + i * 24} ${345 + (i % 3) * 9}q-15 31 0 65q15-37 0-65Z`}
            opacity=".5"
          />
        ))}
      </g>
      <path d="M382 398q415 137 832 16" fill="none" stroke="#5a4a60" strokeWidth="2" />
      {[440, 575, 1010, 1150].map((x, index) => (
        <Lantern key={x} x={x} y={[416, 451, 456, 432][index]} paint={paint} small />
      ))}
      <g className="club-illustration-tea-table" transform="translate(816 842)">
        <ellipse cy="111" rx="190" ry="18" fill="#232735" opacity=".28" />
        <path
          d="M-88 1q20 54 11 106m164-106q-20 54-11 106M-76 60H76"
          fill="none"
          stroke="#322d40"
          strokeWidth="9"
        />
        <ellipse rx="139" ry="32" fill="#8b7486" />
        <path d="M-139 0q137 55 278 0v17q-145 48-278-2Z" fill="#ad939f" />
        <ellipse cy="-3" rx="132" ry="27" fill="#c9b2ba" />
        <path d="M-45-21q-15-40 13-46 28-6 36 22l3 24Z" fill="#e8cdd0" />
        <path
          d="M-40-48q-30-19-31-8l22 25M1-45q30-7 21 15Q14-14 4-22"
          fill="none"
          stroke="#e8cdd0"
          strokeWidth="7"
        />
        <ellipse cx="-24" cy="-63" rx="15" ry="4" fill="#b78eaa" />
        <circle cx="-24" cy="-70" r="4" fill="#e8cdd0" />
        <TeaCup x={-78} y={-7} />
        <TeaCup x={67} y={-6} />
        <ellipse cx="27" cy="4" rx="23" ry="6" fill="#e3c5c9" />
        <ellipse cx="27" cy="1" rx="14" ry="5" fill="#cda877" />
        <path d="M22-1h2m5 1h2" stroke="#94725b" strokeWidth="2" />
        <path
          d="M-27-82q-10-13 0-24m14 23q-9-12 0-23"
          fill="none"
          stroke="#e7d2d9"
          opacity=".35"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <GardenChair x={567} y={848} />
      <GardenChair x={1067} y={852} flip />
      <g>
        {[
          [-12, 821, 1.7],
          [97, 897, 1.5],
          [265, 915, 1.4],
          [1257, 920, 1.4],
          [1420, 874, 1.7],
          [1564, 821, 2],
        ].map(([x, y, scale], index) => (
          <Foliage key={x} x={x} y={y} scale={scale} color={index % 2 ? "#2c4844" : "#344d4c"} />
        ))}
      </g>
      <g fill="#c18d9f">
        {[
          [135, 897],
          [251, 949],
          [303, 926],
          [1239, 954],
          [1326, 923],
          [1467, 911],
        ].map(([x, y]) => (
          <g key={x}>
            <circle cx={x} cy={y} r="6" />
            <circle cx={x - 6} cy={y - 5} r="5" />
            <circle cx={x + 5} cy={y - 6} r="5" />
            <circle cx={x} cy={y - 4} r="2" fill="#edc18f" />
          </g>
        ))}
      </g>
    </>
  );
}

function TeaCup({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cy="6" rx="21" ry="5" fill="#b59caf" />
      <path d="M-13-11h26l-3 17h-20Z" fill="#ead4d6" />
      <path d="M13-8q14-1 10 9-3 6-12 3" fill="none" stroke="#ead4d6" strokeWidth="3" />
      <ellipse cy="-11" rx="13" ry="3" fill="#92727f" />
    </g>
  );
}

function GardenChair({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? "-1" : "1"} 1)`}
      fill="none"
      stroke="#393345"
      strokeWidth="7"
    >
      <path d="M-50 0v-54q0-62 40-62t40 62v54M-65 4h107M-45 9l-17 85M29 9l14 85M-47 46h82" />
      <path d="M-29-14v-52q0-37 18-37t18 37v52M-11-14v-79" strokeWidth="3" />
      <path d="M-64 1h107" stroke="#a190a4" strokeWidth="3" />
    </g>
  );
}

function MidnightMeeting({ paint }: { paint: Paint }) {
  return (
    <>
      <rect width="1600" height="1000" fill={paint("room")} />
      <g className="club-illustration-window">
        <path
          d="M1120 776V280q0-105 153-105t153 105v496Z"
          fill="#30273f"
          stroke="#746078"
          strokeWidth="15"
        />
        <path d="M1136 755V280q0-91 137-91t137 91v475Z" fill={paint("night-sky")} />
        <circle cx="1308" cy="308" r="96" fill={paint("moon-glow")} />
        <circle cx="1308" cy="308" r="34" fill="#ddcddf" />
        <circle cx="1321" cy="297" r="30" fill="#4d3f5e" />
        <path d="M1138 681q70-52 122-17 61-48 150 14v77h-272Z" fill="#393b53" />
        <path d="M1151 725h246m-220 13h113" stroke="#a9a2b9" opacity=".18" />
        <g fill="#e0cadc" opacity=".58">
          <circle cx="1193" cy="279" r="1.4" />
          <circle cx="1384" cy="373" r="1.6" />
          <circle cx="1205" cy="480" r="1.1" />
          <circle cx="1327" cy="580" r="1.4" />
        </g>
        <path d="M1274 188v575m-147-353h291m-291 196h291" stroke="#58465f" strokeWidth="10" />
        <path d="M1103 776h339" stroke="#9a7c92" strokeWidth="10" />
        <path
          d="M1084 165q6 254-14 462l-32 158q39 20 74-4l34-93q-20-160-8-354 5-93 29-157Z"
          fill="#6b4d70"
        />
        <path
          d="M1455 165q-6 254 14 462l32 158q-39 20-74-4l-34-93q20-160 8-354-5-93-29-157Z"
          fill="#6b4d70"
        />
        <path
          d="M1094 184q19 216-1 446m347-446q-19 216 1 446"
          fill="none"
          stroke="#aa809c"
          strokeWidth="3"
          opacity=".3"
        />
        <path d="m1071 657 53 10m298 0 54-10" stroke="#c1a180" strokeWidth="5" />
      </g>
      <g stroke="#b08da4" fill="none" opacity=".1">
        <path d="M0 158h1003M0 171h1003M0 792h1600M0 814h1600" strokeWidth="3" />
        {[64, 242, 420, 598, 776, 954].map((x) => (
          <path key={x} d={`M${x} 193v563m-13-547h26v525h-26Z`} />
        ))}
      </g>
      <path d="M0 848h1600v152H0Z" fill="#2b2538" />
      <path
        d="M0 850h1600M0 934h1600M165 850 87 1000m351-150-42 150m326-150v150m298-150 40 150m268-150 83 150"
        stroke="#75576c"
        strokeWidth="2"
        opacity=".23"
      />
      <g transform="translate(72 506)">
        <path d="M0 0h210v366H0Z" fill="#372c41" stroke="#7a5970" strokeWidth="8" />
        <path d="M-7 101h224M-7 204h224M-7 302h224" stroke="#806078" strokeWidth="7" />
        <Books x={14} y={98} count={9} />
        <Books x={14} y={201} count={8} />
        <Books x={14} y={299} count={9} />
        <ellipse cx="148" cy="-4" rx="23" ry="3" fill="#30273c" opacity=".6" />
        <path d="M136-5q-22-16-17-43l15-25h28l15 25q5 27-17 43Z" fill="#9a7b91" />
        <path d="M135-8h26v4h-26Z" fill="#b397a7" />
        <path d="M129-43q-3 13 6 24" fill="none" stroke="#c0a2b4" strokeWidth="2" opacity=".35" />
        <path
          d="M148-73v-33m0 16q-27-27-34-10m34 0q30-35 40-21"
          fill="none"
          stroke="#748473"
          strokeWidth="4"
        />
        <path d="M116-104q-16-21-35-9 10 27 35 9m68-12q6-21 29-17 1 28-29 17" fill="#748473" />
      </g>
      <g transform="translate(377 686)">
        <ellipse cx="-6" cy="217" rx="132" ry="9" fill="#201c2b" opacity=".35" />
        <path d="M-96 163v53m174-53v53" stroke="#30283a" strokeWidth="13" strokeLinecap="round" />
        <path
          d="M-91 158V40q0-99 84-99T77 40v118Z"
          fill="#78516b"
          stroke="#32293e"
          strokeWidth="8"
        />
        <path
          d="M-67 137V38q0-72 60-72t60 72v99"
          fill="#805870"
          stroke="#a2798c"
          strokeWidth="3"
          opacity=".7"
        />
        <path d="M-94 126H80v64H-94Z" fill="#68465f" stroke="#32293e" strokeWidth="6" />
        <path d="M-88 126q80-10 162 0v24H-88Z" fill="#ab8093" />
        <path
          d="M-122 86q-12-41 9-43 19-2 23 25l13 82v34h-39Z"
          fill="#68465f"
          stroke="#32293e"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M108 86q12-41-9-43-19-2-23 25l-13 82v34h39Z"
          fill="#68465f"
          stroke="#32293e"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M-117 70q-1-14 5-15 8-1 12 18l12 72M103 70q1-14-5-15-8-1-12 18l-12 72"
          fill="none"
          stroke="#a67c90"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".6"
        />
        <rect x="-78" y="139" width="142" height="47" rx="8" fill="#90647c" />
        <path d="M-68 148H54" fill="none" stroke="#b88b9d" strokeWidth="2" opacity=".45" />
        <path d="M-30 126q-2-24 23-28 26 4 26 28Z" fill="#bc93a7" opacity=".6" />
      </g>
      <ellipse cx="822" cy="941" rx="344" ry="49" fill="#695165" opacity=".54" />
      <ellipse
        cx="822"
        cy="941"
        rx="319"
        ry="37"
        fill="none"
        stroke="#ad7c91"
        opacity=".28"
        strokeWidth="3"
      />
      <g transform="translate(818 854)">
        <path
          d="M-105 0q27 38 3 82m209-82q-27 38-3 82m-202-22h195"
          fill="none"
          stroke="#3b2b3d"
          strokeWidth="11"
        />
        <ellipse rx="190" ry="42" fill="#563d53" />
        <path d="M-190-1v14q182 70 380-2V-1" fill="#775569" />
        <ellipse cy="-5" rx="188" ry="39" fill="#967384" />
        <path d="m-95-14 77-11 73 26-66 10Z" fill="#dec7cd" />
        <path d="m-95-14 76 1 74 14M-19-13l10 24" fill="none" stroke="#795569" strokeWidth="2" />
        <path
          d="m-77-11 38 3m-34 2 37 3M-3-10l32 10m-32-4 26 7"
          stroke="#a88a9d"
          strokeWidth="1.5"
        />
        <TeaCup x={-125} y={9} />
        <TeaCup x={112} y={7} />
        <Candle x={55} y={-14} paint={paint} />
        <Candle x={89} y={-19} paint={paint} short />
        <path d="m-41 17 29 10 51-10-30-10Z" fill="#68566c" />
        <path d="m-41 20 29 10 51-10" fill="none" stroke="#d8bac5" strokeWidth="3" />
      </g>
      <g transform="translate(1120 850)">
        <path d="M-23 15q-13-76 7-93 10 5 11 22 0-32 17-41 22 25 12 65l-6 48Z" fill="#211e2d" />
        <path
          d="M-25 14q-67-19-65 11 0 23 66 14"
          fill="none"
          stroke="#211e2d"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path d="m-3-64 5-5m11 3 5-3" stroke="#d2b391" strokeWidth="2" />
      </g>
      <path
        d="M1491 849V630q0-24 29-24v48"
        fill="none"
        stroke="#362b40"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M1476 849h30" stroke="#8b6b7e" strokeWidth="5" strokeLinecap="round" />
      <Lantern x={1520} y={682} paint={paint} />
    </>
  );
}

function Books({ x, y, count }: { x: number; y: number; count: number }) {
  const colors = ["#8f687e", "#a08785", "#687879", "#b79793", "#755a7b"];
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`translate(${i * 20} 0) rotate(${i === count - 2 ? "-7" : "0"})`}>
          <rect
            y={-54 - (i % 3) * 9}
            width="16"
            height={54 + (i % 3) * 9}
            rx="1"
            fill={colors[i % colors.length]}
          />
          <path
            d={`M3 ${-46 - (i % 3) * 9}h10M3-8h10`}
            stroke="#d0adab"
            strokeWidth="2"
            opacity=".6"
          />
          <path d={`M3 ${-30 - (i % 3) * 9}v17`} stroke="#342a3e" strokeWidth="1.5" opacity=".4" />
        </g>
      ))}
    </g>
  );
}

function Candle({
  x,
  y,
  paint,
  short = false,
}: {
  x: number;
  y: number;
  paint: Paint;
  short?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cy="-42" r="108" fill={paint("glow")} />
      <ellipse cy="5" rx="17" ry="5" fill="#bf9c84" />
      <path d={`M-6 0v-${short ? 25 : 43}h12V0Z`} fill="#ebd1b2" />
      <path d={`M0-${short ? 28 : 46}q-9-9 0-23 10 13 0 23Z`} fill="#f3cf9c" />
      <path d={`M0-${short ? 31 : 49}v-8`} stroke="#ffe7be" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function MoonlitPier({ paint }: { paint: Paint }) {
  return (
    <>
      <rect width="1600" height="1000" fill={paint("night-sky")} />
      <Stars />
      <circle cx="350" cy="358" r="190" fill={paint("moon-glow")} />
      <circle cx="350" cy="358" r="59" fill="#d4cadd" />
      <g fill="#aaa0bf" opacity=".25">
        <circle cx="330" cy="341" r="14" />
        <circle cx="370" cy="379" r="11" />
        <circle cx="342" cy="386" r="7" />
      </g>
      <g fill="none" stroke="#baabc8" strokeWidth="3" opacity=".12" strokeLinecap="round">
        <path d="M93 485q159-15 296 0m725-88q180-17 362 0m-307 20h151" />
      </g>
      <path
        d="M0 669q123-65 215-23 186-86 321 20 143-52 241-10 137-86 280-4 176-80 301-23 123-50 242 35v76H0Z"
        fill="#4b4d68"
      />
      <Water paint={paint} night />
      <g fill="#c9c4d9" opacity=".2">
        {Array.from({ length: 10 }, (_, i) => (
          <path
            key={i}
            d={`M${318 - i * 13} ${701 + i * 23}q${31 + i * 12} -4 ${67 + i * 23} 0l-8 4H${325 - i * 13}Z`}
          />
        ))}
      </g>
      <g className="club-illustration-lighthouse" transform="translate(1060 732)">
        <path d="M-126 83q-5-57 53-79 47-17 74 3 58-45 118-14 70-14 110 54l-5 36Z" fill="#35384b" />
        <path d="M-57 22-37-180h80L70 22Z" fill="#b4a2b3" />
        <path d="M-22-180h28L17 22h-43Z" fill="#d4bac7" opacity=".38" />
        <path d="m-50-49 5-38 108 0 5 38Z" fill="#816e8b" />
        <path d="M-45-124h97l5 32H-48Z" fill="#816e8b" />
        <path d="M-24-180v-43h53v43Z" fill="#e6c79e" stroke="#4b4058" strokeWidth="7" />
        <circle cx="3" cy="-203" r="128" fill={paint("glow")} />
        <path d="M-35-227 2-247l38 20Z" fill="#3b334b" />
        <path d="M-49-177h101m-39-47v43M-48-167h100" stroke="#463b51" strokeWidth="6" />
        <path
          d="M-47-194v27m23-27v27m26-27v27m25-27v27m24-27v27"
          stroke="#463b51"
          strokeWidth="3"
        />
        <path d="M-4 22v-41q15-13 28 0v41" fill="#443b50" />
        <path d="M-6-147v17m5 70v15" stroke="#443b50" strokeWidth="10" />
        <path d="m32-208 449-87v132Z" fill="#ead6b6" opacity=".04" />
        <Cottage x={70} y={-53} width={101} height={77} color="#827189" />
      </g>
      <g transform="translate(802 879)">
        <path d="M-158 121-45-55h428L519 121Z" fill={paint("wood")} />
        <path d="M-45-55h428v12H-45Z" fill="#a28798" />
        <g stroke="#b99cab" opacity=".23" strokeWidth="2">
          <path d="M-68-17h475M-91 21h532M-121 67h597M-158 118h677M55-45-21 121M143-45l-32 166M228-45l14 166M315-45l63 166" />
        </g>
        <g fill="#41354b" stroke="#a78b9e" strokeWidth="2">
          <path d="M-69-20v-67h13v67ZM-124 65V-29h16v94ZM-186 160V35h20v125ZM409-20v-67h13v67ZM465 65V-29h16v94ZM526 160V35h20v125Z" />
        </g>
        <path d="M-66-69-178 61m595-130L537 61" stroke="#92758b" strokeWidth="7" />
        <path
          d="M-63-44q-19 36-53 33m-4 28q-19 45-58 42m593-103q17 34 52 33m5 28q24 42 66 42"
          fill="none"
          stroke="#c0a796"
          strokeWidth="3"
          opacity=".6"
        />
        <Lantern x={-62} y={-107} paint={paint} small />
        <Lantern x={417} y={-107} paint={paint} small />
      </g>
      <g transform="translate(610 861)" fill="#272b3d">
        <path d="M-82 18q77 21 154-2l-21 23q-70 14-118-4Z" />
        <path d="M-16 18V-45h32v63" />
        <path d="m-28-45 38-47 24 47Z" fill="#738092" />
        <path d="M-18-45V17" stroke="#b4a5b9" strokeWidth="2" />
        <path
          d="M-77 36q52 8 114 0m-90 12h73"
          fill="none"
          stroke="#97a6b8"
          strokeWidth="1.5"
          opacity=".3"
          strokeLinecap="round"
        />
      </g>
      <ForegroundReeds />
    </>
  );
}

function ForegroundReeds() {
  return (
    <g fill="none" strokeLinecap="round">
      <path
        d="M0 999q35-109 100-160M46 1000q-1-153 34-217M84 1000q35-88 104-114M1550 1000q-12-149-70-209M1590 1000q-46-130-119-149M1520 1000q-32-82-75-105"
        stroke="#242c3b"
        strokeWidth="7"
      />
      <path
        d="M94 845q-31-33-47-13m40-9q20-38 35-32M171 893q-13-27-37-23m1349-54q-29-20-47-13m34 45q17-38 33-25"
        stroke="#3c4e51"
        strokeWidth="9"
      />
      <path d="M0 988q129-27 225 12m1150 0q135-24 225-11" stroke="#202a35" strokeWidth="24" />
    </g>
  );
}
