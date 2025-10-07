"use client"; // ← 一番上に！

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import * as THREE from "three";

// Supabase設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type OrnamentData = {
  position: [number, number, number];
  country: string;
  message: string;
};

export default function Scene() {
  const [ornaments, setOrnaments] = useState<OrnamentData[]>([]);
  const [selected, setSelected] = useState<OrnamentData | null>(null);
  const [message, setMessage] = useState("");
  const [country, setCountry] = useState("🇯🇵");
  const [clickPos, setClickPos] = useState<[number, number, number] | null>(null);
  const [isAdding, setIsAdding] = useState(false); // ← 追加モードON/OFF

  // 🎄 Supabaseから読み込み
useEffect(() => {
  async function loadOrnaments() {
    const { data, error } = await supabase.from("ornaments").select("*");
    if (!error && data) {
      const loaded = data.map((d): OrnamentData => ({
        position: [
          Number(d.x ?? 0),
          Number(d.y ?? 0),
          Number(d.z ?? 0),
        ] as [number, number, number],
        country: String(d.country ?? ""),
        message: String(d.message ?? ""),
      }));
      setOrnaments(loaded as OrnamentData[]);
    } else {
      console.error("読み込みエラー:", error);
    }
  }
  loadOrnaments();
}, []);


  // 🔄 リアルタイム反映
  useEffect(() => {
    const channel = supabase
      .channel("ornaments-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ornaments" },
        (payload) => {
          const d = payload.new;
          const newOrnament = {
            position: [d.x, d.y, d.z],
            country: d.country,
            message: d.message,
          };
          setOrnaments((prev) => [...prev, newOrnament]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 🎨 初期オーナメント配置
  const baseOrnaments = useMemo(() => {
    const arr: OrnamentData[] = [];
    const count = 200;
    const countries = ["🇯🇵", "🇺🇸", "🇫🇷", "🇧🇷", "🇩🇪", "🇨🇳", "🇰🇷"];
    for (let i = 0; i < count; i++) {
      const height = Math.random() * 6;
      const radius = 2.5 * (1 - height / 6);
      const theta = Math.random() * Math.PI * 2;
      const x = Math.cos(theta) * (radius + 0.2);
      const y = height - 2.7;
      const z = Math.sin(theta) * (radius + 0.2);
      arr.push({
        position: [x, y, z],
        country: countries[Math.floor(Math.random() * countries.length)],
        message: `Happy Holidays ${i + 1}!`,
      });
    }
    return arr;
  }, []);

  const allOrnaments = [...baseOrnaments, ...ornaments];

  // 🧭 オーナメント追加（クリック位置優先）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let x, y, z;

    if (clickPos) {
      [x, y, z] = clickPos; // クリック位置
    } else {
      const height = Math.random() * 6;
      const radius = 2.5 * (1 - height / 6);
      const theta = Math.random() * Math.PI * 2;
      x = Math.cos(theta) * (radius + 0.2);
      y = height - 0.6;
      z = Math.sin(theta) * (radius + 0.2);
    }

    const newOrnament: OrnamentData = { position: [x, y, z], country, message };
    setOrnaments((prev) => [...prev, newOrnament]);
    setMessage("");
    setClickPos(null);

    const { error } = await supabase.from("ornaments").insert([{ x, y, z, country, message }]);
    if (error) console.error("保存エラー:", error);
    else console.log("✅ Supabaseに保存成功!");
  };

  // 🖼️ レンダリング
  return (
    <div className="relative w-screen h-screen">
      <Canvas camera={{ position: [0, 10, 10], fov: 50 }} gl={{ antialias: true }}>
        <color attach="background" args={["#0b0c1a"]} />
        <fog attach="fog" args={["#0b0c1a", 10, 25]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 10]} intensity={1.2} />
        <pointLight position={[0, 10, 0]} intensity={1.5} color="#ffdddd" />

        {/* 雪 */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={500}
              array={new Float32Array(
                Array.from({ length: 500 * 3 }, () => (Math.random() - 0.5) * 40)
              )}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial color="white" size={0.1} sizeAttenuation />
        </points>

        {/* 🎄ツリー */}
        <mesh position={[0, 0.4, 0]}>
          <coneGeometry args={[2.5, 6, 64]} />
          <meshStandardMaterial color="#1f8d3a" />
        </mesh>

        {/* 🖱️ クリックで位置選択（追加モード時のみ） */}
        {isAdding && (
          <mesh
            position={[0, 0, 0]}
            onClick={(e) => {
  e.stopPropagation();

  // ツリー表面より少し外にずらす（法線方向に）
  const normal = e.face?.normal.clone().applyNormalMatrix(e.object.normalMatrix);
  const offset = normal ? normal.multiplyScalar(0.25) : new THREE.Vector3(0, 0, 0);
  const pos = e.point.clone().add(offset);

  setClickPos([pos.x, pos.y, pos.z]);
  setIsAdding(false);

  console.log("クリック座標（補正後）:", pos);
}}

            visible={false}
          >
            <coneGeometry args={[2.5, 6, 64]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )}

        {/* プレビュー */}
        {clickPos && (
          <mesh position={clickPos}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={3} />
          </mesh>
        )}

        {/* オーナメント */}
        {allOrnaments.map((o, i) => {
          const isNew = i >= baseOrnaments.length;
          return (
            <mesh key={i} position={o.position} onClick={() => setSelected(o)}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial
                emissive={isNew ? "#00ff00" : "#ff4081"}
                emissiveIntensity={2}
                color={isNew ? "#00ff88" : "#ff8da1"}
              />
            </mesh>
          );
        })}

        <OrbitControls />
      </Canvas>

      {/* ✨ モード中オーバーレイ */}
      {isAdding && (
  <div
    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xl font-bold z-10"
    style={{ pointerEvents: "none" }} // 👈 この行を追加！
  >
    ✨ ツリーの上をクリックしてオーナメントを置く場所を選んでください ✨
  </div>
)}


      {/* 💬 メッセージポップアップ */}
      {selected && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/90 text-black p-4 rounded-xl shadow-lg text-center">
          <div className="text-3xl">{selected.country}</div>
          <div className="mt-1 font-semibold">{selected.message}</div>
          <button
            onClick={() => setSelected(null)}
            className="mt-2 px-4 py-1 bg-black text-white rounded-lg"
          >
            閉じる
          </button>
        </div>
      )}

      {/* 📝 投稿フォーム */}
      <form
        onSubmit={handleSubmit}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 p-3 rounded-lg shadow-lg flex gap-2"
      >
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="p-2 rounded border"
        >
          <option>🇯🇵</option>
          <option>🇺🇸</option>
          <option>🇫🇷</option>
          <option>🇩🇪</option>
          <option>🇧🇷</option>
          <option>🇨🇳</option>
          <option>🇰🇷</option>
        </select>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="メッセージを書く"
          className="p-2 border rounded w-48"
          required
        />

        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="px-4 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          追加場所を選択
        </button>

        <button
          type="submit"
          className="px-4 bg-green-600 text-white rounded hover:bg-green-700"
        >
          追加
        </button>
      </form>
    </div>
  );
}
