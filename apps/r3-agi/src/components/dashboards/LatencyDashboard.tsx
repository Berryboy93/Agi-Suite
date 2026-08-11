/**
 * Investor Demo — LLPTE Pipeline Latency Dashboard
 * Displays p50/p99/p99.9 per node, fetches from Agi-Suite /api/latency
 */
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface LatencyData {
  nodeId: string;
  p50Ms: number;
  p99Ms: number;
  p99_9Ms: number;
  sampleCount: number;
}

interface Response {
  data: LatencyData[];
  window: string;
  error?: string;
  recordedAt?: string;
}

const NODES = [
  "inputRouter",
  "spectralAnalyzer",
  "aiMixEngine",
  "transitionGraph",
  "outputBus",
];

export function LatencyDashboard() {
  const [data, setData] = useState<LatencyData[]>([]);
  const [window, setWindow] = useState<"24h" | "7d">("24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/latency?window=${window}`)
      .then((res) => res.json() as Promise<Response>)
      .then((json) => {
        if (json.error) {
          setError(json.error);
          setData([]);
        } else {
          setData(json.data || []);
        }
      })
      .catch((err) => {
        setError((err as Error).message);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [window]);

  const chartData = NODES.map((nodeId) => {
    const node = data.find((d) => d.nodeId === nodeId);
    return {
      name: nodeId.replace(/([A-Z])/g, " $1").trim(),
      p50: node?.p50Ms ?? 0,
      p99: node?.p99Ms ?? 0,
      p99_9: node?.p99_9Ms ?? 0,
    };
  });

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          LLPTE Pipeline Latency
        </h1>
        <p className="text-slate-300 text-lg">
          Real-time latency metrics across the 5-node pipeline. SLA target:
          ≤15ms p50.
        </p>
      </div>

      {/* Window toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setWindow("24h")}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            window === "24h"
              ? "bg-lime-500 text-black shadow-lg shadow-lime-500/50"
              : "bg-slate-700 text-white hover:bg-slate-600"
          }`}
        >
          24 Hours
        </button>
        <button
          onClick={() => setWindow("7d")}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            window === "7d"
              ? "bg-lime-500 text-black shadow-lg shadow-lime-500/50"
              : "bg-slate-700 text-white hover:bg-slate-600"
          }`}
        >
          7 Days
        </button>
      </div>

      {/* Status */}
      {loading && <p className="text-slate-400">Loading latency data...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {/* Chart */}
      {data.length > 0 && !loading && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            Percentile Latencies (ms)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#cbd5e1" />
              <YAxis stroke="#cbd5e1" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend />
              <Bar dataKey="p50" fill="#84cc16" name="p50" />
              <Bar dataKey="p99" fill="#fbbf24" name="p99" />
              <Bar dataKey="p99_9" fill="#ef4444" name="p99.9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats grid */}
      {data.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {data.map((node) => (
            <div
              key={node.nodeId}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3"
            >
              <h3 className="font-bold text-lime-400 text-sm">
                {node.nodeId.replace(/([A-Z])/g, " $1").trim()}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">p50</span>
                  <span className="text-white font-mono">{node.p50Ms}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">p99</span>
                  <span className="text-white font-mono">{node.p99Ms}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">p99.9</span>
                  <span className="text-white font-mono">{node.p99_9Ms}ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">samples</span>
                  <span className="text-slate-400">{node.sampleCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
