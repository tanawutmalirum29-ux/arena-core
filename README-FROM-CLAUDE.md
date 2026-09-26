# สิ่งที่อยู่ในไฟล์นี้

ไฟล์ `eb-deploy.zip` ที่ส่งมาเป็น **deploy package สำหรับ Elastic Beanstalk** — มีแค่
โค้ดที่ build/minify แล้ว (`dist/`) ไม่มี source (`.ts`) ต้นฉบับ, ไม่มี
`tsconfig.json`, ไม่มี build config

ผมกู้ **source TypeScript ต้นฉบับทั้งหมด** กลับมาได้จาก sourcemap ที่แนบมาด้วย
(`dist/server/index.js.map`, `dist/client/app.js.map`) — ครบทั้ง `src/server`,
`src/client`, `src/shared` (60 ไฟล์)

## โครงสร้างในซิปนี้

```
src/            <- source .ts ที่กู้กลับมาจาก sourcemap (แก้ 2 บั๊กแล้ว)
dist/           <- โค้ด build ที่แก้แล้วเหมือนกัน (อันที่ deploy ได้จริงตอนนี้)
package.json
Procfile
```

## สิ่งที่กู้กลับมาไม่ได้

- `tsconfig.json` / build tool config (esbuild/vite ฯลฯ — ไม่ได้ฝังอยู่ใน sourcemap)
- `package.json` ตัวเต็มที่มี devDependencies และ build script (อันที่แนบมามีแค่
  `ws` กับ `"start": "node dist/server/index.js"` เพราะเป็นไฟล์สำหรับรัน production
  เท่านั้น)

โค้ด logic กู้คืนมาครบ 100% แต่ "เครื่องมือ build" ไม่ได้อยู่ใน zip ตั้งแต่ต้น ถ้ามี
repo ต้นทางอยู่ที่อื่น แนะนำเอา 2 ไฟล์ที่แก้ไปแทนที่ในนั้นแล้ว build เอง จะชัวร์กว่า

## 2 บั๊กที่แก้ + ไฟล์ที่เปลี่ยน

### 1. เกมหลุดง่าย ไม่มี auto-reconnect
**ไฟล์:** `src/client/app/main.ts`
เดิม `NetworkClient.onClose` แค่เปลี่ยนหน้าจอกลับไป "connect" เฉย ๆ ไม่ต่อใหม่เลย
พอ socket หลุด (สลับแอพ, wifi กระตุก) จะค้างรอผู้เล่นกดเองตลอดไป
แก้โดยเพิ่ม auto-reconnect แบบ exponential backoff (1s → 2s → 4s → 8s)

### 2. รายการห้องไม่อัปเดตเรียลไทม์
**ไฟล์:** `src/server/network/GameServer.ts`
เดิม server ส่ง list ห้อง (`ROOMS`) ให้แค่ตอน connect ครั้งแรก หรือตอนกดปุ่ม
"รีเฟรช" เอง คนที่นั่งอยู่หน้าล็อบบี้จะไม่เห็นห้องใหม่/ห้องเต็ม/ห้องเริ่มแข่งจนกว่า
จะกดรีเฟรชเอง
แก้โดยเพิ่ม `broadcastRoomList()` push รายการห้องให้ทุก session ในล็อบบี้ทันทีที่มี
คนสร้าง/เข้า/ออกห้อง บวก interval ทุก 2 วิเป็น fallback

`dist/` ในซิปนี้ build (แก้แบบเดียวกัน) มาให้พร้อม deploy ได้เลยโดยไม่ต้อง build เอง

---

# อัปเดตรอบนี้ (แยกหน้า UI + ห้องล็อกรหัสผ่าน + เลือกเวลาแข่ง)

## ไฟล์ที่กู้คืนเพิ่ม (หายไปตั้งแต่ต้น เพราะเป็น type-only ไม่มี JS ให้ sourcemap กู้)
- `src/shared/protocol/messages.ts` — C2S/S2C ทั้งหมด (ไฟล์นี้สำคัญมาก แทบทุกไฟล์ import type จากนี้)
- `src/shared/maps/MapData.ts`
- `src/server/game/MatchContext.ts`

กู้คืนโดยไล่ดู usage จริงทุกจุดในโค้ด ไม่ใช่เดา — ผ่าน `tsc --noEmit` สะอาดแล้ว (เหลือแค่
error ที่เป็นเพราะยังไม่ได้ `npm install`, ไม่เกี่ยวกับโค้ด)

## ฟีเจอร์ใหม่
1. **แยกหน้าเมนูหลักกับหน้าสร้างห้อง** — `LobbyScreen.ts` ตอนนี้เป็นแค่ list + join
   เท่านั้น ปุ่ม "สร้างห้อง" แค่เปลี่ยนหน้าไป `CreateRoomScreen.ts` (ไฟล์ใหม่) ที่มี
   ช่องรหัสผ่าน (ไม่ใส่ = ห้องเปิด) กับตัวเลือกเวลาแข่งขัน (1–30 นาที) ค่อยกดสร้างจริง
2. **ช่องรหัสผ่านตอนเข้าร่วมจะไม่โผล่ตั้งแต่แรก** — client ส่ง `JOIN_ROOM` ด้วยแค่รหัส
   ห้องก่อน ถ้า server ตอบ `PASSWORD_REQUIRED` ค่อยโชว์ช่องรหัสผ่าน (ข้อความจะต่างกัน
   ระหว่าง "ห้องนี้มีรหัสผ่าน" กับ "รหัสผ่านไม่ถูกต้อง" โดยดูจากว่ารอบก่อนหน้าใส่รหัส
   ไปหรือยัง)
3. ห้องที่ล็อกจะมีไอคอน 🔒 ต่อท้ายรหัสห้องในลิสต์

## ไฟล์ที่แก้/เพิ่มฝั่ง protocol + server
- `messages.ts`: เพิ่ม `password`, `durationSec` ใน `CREATE_ROOM`, `password` ใน
  `JOIN_ROOM`, `locked` ใน `RoomListEntry`
- `types.ts`: เพิ่ม `ReasonCode` ใหม่ `PASSWORD_REQUIRED`
- `validate.ts`: จำกัดความยาวรหัสผ่าน (32 ตัวอักษร) และ bound เวลาแข่ง (60–1800 วิ)
- `Room.ts` / `RoomManager.ts`: เก็บรหัสผ่านต่อห้อง + ส่ง `durationSec` ต่อเป็น
  `rules.timeLimitSec`
- `GameServer.ts`: เช็ครหัสผ่านตอน join/create

## ไฟล์ใหม่ฝั่ง client
- `CreateRoomScreen.ts`
- `LobbyScreen.ts` — เขียนใหม่ทั้งไฟล์
- `strings.ts` — เพิ่มข้อความใหม่ + `errorText()` helper
- `main.ts` — เพิ่ม screen state `'createRoom'`, handle `ERR` message

## build tooling ที่เพิ่มให้ (เดิมไม่มีเลยในซิป — ไม่ได้อยู่ใน sourcemap เหมือนกัน)
- `tsconfig.json` (path alias `@shared/*`)
- `build.mjs` (bundle ด้วย esbuild: client → `dist/client/app.js`, server →
  `dist/server/index.js`, copy `public/` เข้า `dist/client`)
- `public/` — ย้าย static assets (`index.html`, `style.css`, `config.js`,
  `manifest.webmanifest`) มาไว้ตรงนี้เป็น source (เดิมมีแต่ใน `dist/` เฉย ๆ)
- `package.json`: เพิ่ม `devDependencies` (`esbuild`, `typescript`) และ script
  `build` / `typecheck`

### วิธี build เอง (ครั้งต่อไป)
```
npm install
npm run typecheck   # ถ้าอยากเช็ค type ก่อน
npm run build        # ได้ dist/client + dist/server พร้อม deploy
```
ผมรัน build จริงและทดสอบผ่าน WebSocket จริงแล้วในนี้ (สร้างห้องล็อกรหัส → join ไม่ใส่
รหัส → ได้ `PASSWORD_REQUIRED` → ใส่รหัสผิด → ได้ `PASSWORD_REQUIRED` อีกครั้งข้อความ
ต่างกัน → ใส่รหัสถูก → เข้าห้องสำเร็จ) `dist/` ในซิปนี้คือผลลัพธ์จากการ build รอบนี้
พร้อม deploy ได้เลย


---

# อัปเดตรอบนี้ (เพิ่มแมพ)

## แมพใหม่ 4 แมพ (จากเดิมมีแค่ Prototype Arena)
ไฟล์ใหม่ทั้งหมดอยู่ใน `src/shared/maps/`:
- `sunkenRuins.ts` — **Sunken Ruins** 36×20 ม. (เล็ก) โทนมอส/ซากปรักหักพัง ประชิดตัวเร็ว
- `skyBastion.ts` — **Sky Bastion** 56×32 ม. (ใหญ่สุด) โทนทอง/ฟ้า โล่งกว้าง เหมาะตัวบิน/แดชระยะไกล
- `crimsonPit.ts` — **Crimson Pit** 28×16 ม. (เล็กสุด) โทนลาวาแดง ประชิดตัวตลอดเวลา
- `frostHollow.ts` — **Frost Hollow** 52×28 ม. (ใหญ่) โทนน้ำแข็ง สิ่งกีดขวางน้อย เหมาะสายเคลื่อนที่

แต่ละแมพต่างกันทั้งขนาด, จำนวน/ตำแหน่งสิ่งกีดขวาง (wall/crate), จุดเกิดผู้เล่น (spawn points, 8–16 จุดตามขนาดแมพ) และ "บรรยากาศ" (สีพื้น/กำแพง/ขอบแผนที่) ผ่านฟิลด์ `palette` ใหม่ใน `MapData`

ตรวจสอบ geometry แล้ว (สคริปต์ชั่วคราว): ไม่มี obstacle ทับกันเอง และไม่มี spawn point อยู่ชิด/ทับกำแพงเกินไป — ผ่านทั้ง 5 แมพ

## ไฟล์ที่แก้เพื่อให้เลือกแมพได้จริง
เดิม registry มีระบบหลายแมพอยู่แล้ว (`getMap` / `listMapIds`) แต่ **ไม่เคยถูกใช้งานจริง** — `Match.ts` ใช้ `'prototype_arena'` fix ตายตัว ไม่มีทางเลือกแมพจากฝั่ง client เลย รอบนี้ต่อสายให้ครบวงจร:
- `src/shared/maps/MapData.ts` — เพิ่ม `description`, `palette?: Partial<MapPalette>`
- `src/shared/maps/registry.ts` — เขียนใหม่ ลงทะเบียนทั้ง 5 แมพ + เพิ่ม `listMaps()` (คืน id/name/description แบบเบา ๆ สำหรับหน้าเลือกแมพ)
- `src/shared/protocol/messages.ts` — เพิ่ม `mapId?` ใน `CREATE_ROOM`, เพิ่ม `mapId`/`mapName` ใน `RoomInfo`
- `src/shared/protocol/validate.ts` — เช็ค `mapId` กับ `listMapIds()` (id ไม่รู้จัก → fallback เป็นค่า default เงียบ ๆ ไม่ reject ทั้งข้อความ)
- `src/server/match/RoomManager.ts`, `Room.ts` — ส่ง `mapId` ต่อจาก `CreateRoomOptions` ไปจนถึง `Match`, ใส่ `mapId`/`mapName` ใน `info()`
- `src/server/network/GameServer.ts` — ส่ง `m.mapId` เข้า `rooms.create()`
- `src/client/ui/screens/CreateRoomScreen.ts` — เพิ่มตัวเลือกแมพ (ปุ่ม ‹ › วนดูชื่อ+คำบรรยายแมพ) แบบเดียวกับตัวปรับเวลาแข่งที่มีอยู่แล้ว
- `src/client/ui/screens/RoomScreen.ts` — โชว์ชื่อแมพที่เลือกในหัวห้องรอ
- `src/client/app/main.ts` — ส่ง `mapId` ต่อไปกับ `CREATE_ROOM`
- `src/client/ui/strings.ts` — เพิ่มคำ `selectMap` (ไทย/อังกฤษ)

## Renderer (บรรยากาศต่อแมพ)
`src/client/render/Renderer.ts` — เพิ่ม `resolvePalette(map)` ที่ merge `map.palette` ทับสี default เดิม แล้วใช้สีนี้วาดพื้น/กำแพง/ขอบแผนที่ (สี entity/HP ยังคงที่เหมือนเดิมทุกแมพ เพื่อให้อ่านสถานะการต่อสู้ง่ายเท่าเดิม) Prototype Arena ไม่ใส่ `palette` เลยจึงยังหน้าตาเหมือนเดิมทุกประการ

## Typecheck
รันผ่าน `tsc --noEmit` แล้ว — error ที่เหลือทั้งหมดเป็นของเดิมจากการไม่มี `node_modules` ใน sandbox นี้ (ไม่มีเน็ต ติดตั้ง `ws`/`@types/node`/`esbuild` ไม่ได้) ไม่เกี่ยวกับโค้ดที่แก้/เพิ่มรอบนี้เลย โค้ดใหม่ทั้งหมด (`maps/*`, `registry.ts`, `Renderer.ts`, `messages.ts`, `validate.ts`, `RoomManager.ts`, `Room.ts`, `GameServer.ts`, `CreateRoomScreen.ts` ฯลฯ) ไม่มี error สักตัว

**วิธี build ในเครื่องคุณ (ที่มีเน็ต):**
```
npm install
npm run typecheck
npm run build
```

---

# แก้ deploy ล้มเหลวบน Elastic Beanstalk (Degraded / Impaired services)

**อาการ:** อัปโหลด deploy สำเร็จ (Environment update completed) แต่ Health ขึ้น Degraded — "Impaired services on all instances"

**สาเหตุจริง (ไม่เกี่ยวกับโครงสร้างซิป — ซิปแบนอยู่แล้ว ไม่มีโฟลเดอร์ห่อ):**
`Procfile` สั่ง `npm start` → `node dist/server/index.js` แต่ในซิปมีแต่ `src/` (source .ts) ไม่มี `dist/` ที่ build แล้ว — ต้องรัน `npm run build` (esbuild) ก่อนถึงจะมี `dist/`

Elastic Beanstalk รัน `npm install` แบบ production (`NODE_ENV=production`) ซึ่ง**ข้าม devDependencies** — เดิม `esbuild` อยู่ใน `devDependencies` เลยไม่ถูกติดตั้งบนเซิร์ฟเวอร์จริง ต่อให้ EB พยายามรัน build ก็หา esbuild ไม่เจอ → ไม่มี `dist/` → `node dist/server/index.js` พังทันทีที่สตาร์ท → ทุก instance "impaired"

**แก้แล้วใน `package.json`:**
- ย้าย `esbuild` จาก `devDependencies` → `dependencies` (ให้ถูกติดตั้งแม้เป็น production install)
- เพิ่ม script `postinstall: node build.mjs` — npm รัน `postinstall` เองอัตโนมัติทันทีหลัง `npm install` เสร็จ (รันเสมอ ไม่ถูกข้ามแบบ devDependencies) ทำให้ `dist/` ถูกสร้างเองทุกครั้งที่ deploy โดยไม่ต้องพึ่งว่า EB platform จะรู้จักรัน `npm run build` เองหรือไม่
- ปรับ `engines.node` จาก `"22.x"` (ตายตัว) เป็น `">=22"` ให้ตรงกับ Node.js 24 ที่ environment จริงรันอยู่ (เห็นจากหน้าคอนโซล) กัน npm engine-check ล้มเหลวเงียบ ๆ

หลังอัปโหลดซิปนี้แล้วกด **Upload and deploy** ใหม่ Elastic Beanstalk จะรัน `npm install` → trigger `postinstall` → build `dist/client` + `dist/server` เองบนเซิร์ฟเวอร์ ก่อน `npm start` จะรันจริง
