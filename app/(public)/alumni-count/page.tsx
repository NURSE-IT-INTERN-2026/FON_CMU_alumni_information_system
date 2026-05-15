"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Dataset {
  degreeLevel: string;
  data: number[];
}

interface ChartData {
  labels: number[];
  datasets: Dataset[];
}

const DEGREE_COLORS: Record<string, string> = {
  DOCTORAL: "#1e3a5f",
  MASTER: "#2c5282",
  BACHELOR: "#4299e1",
  NURSING_CERTIFICATE: "#e8a838",
};

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_CERTIFICATE: "หลักสูตรประกาศนียบัตร",
};

export default function AlumniCountPage() {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/alumni-count");
        if (!res.ok) throw new Error("Failed to fetch");
        const data: ChartData = await res.json();
        setChartData(data);

        const total = data.datasets.reduce(
          (sum, ds) => sum + ds.data.reduce((s, v) => s + v, 0),
          0
        );
        setTotalCount(total);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 text-center">
        <p className="text-[var(--muted)]">ไม่สามารถโหลดข้อมูลได้</p>
      </div>
    );
  }

  const labels = chartData.labels.map((y) => String(y));

  const datasets = chartData.datasets.map((ds) => ({
    label: DEGREE_LABELS[ds.degreeLevel] || ds.degreeLevel,
    data: ds.data,
    borderColor: DEGREE_COLORS[ds.degreeLevel] || "#999",
    backgroundColor: DEGREE_COLORS[ds.degreeLevel] || "#999",
    tension: 0.3,
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "จำนวนนักศึกษาเก่าตามปีที่เข้าศึกษา",
        font: { size: 18 },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "ปีที่เข้าศึกษา (พ.ศ.)",
        },
      },
      y: {
        title: {
          display: true,
          text: "จำนวน (คน)",
        },
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        จำนวนนักศึกษาเก่าตามปีที่เข้าศึกษา
      </h1>

      <div className="overflow-hidden rounded-lg bg-white p-4 shadow-sm sm:p-6">
        <div className="h-[500px]">
          <Line
            data={{ labels, datasets }}
            options={options}
          />
        </div>

        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="mb-4 text-center text-lg font-semibold text-[var(--primary)]">
            จำนวนนักศึกษาเก่าทั้งหมด: {totalCount.toLocaleString()} คน
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {chartData.datasets.map((ds) => {
              const count = ds.data.reduce((s, v) => s + v, 0);
              return (
                <div
                  key={ds.degreeLevel}
                  className="rounded-lg border border-[var(--border)] p-4 text-center"
                >
                  <div
                    className="mx-auto mb-2 h-3 w-12 rounded-full"
                    style={{ backgroundColor: DEGREE_COLORS[ds.degreeLevel] || "#999" }}
                  />
                  <p className="text-sm text-[var(--muted)]">
                    {DEGREE_LABELS[ds.degreeLevel] || ds.degreeLevel}
                  </p>
                  <p className="text-2xl font-bold text-[var(--primary)]">
                    {count.toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--muted)]">คน</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
