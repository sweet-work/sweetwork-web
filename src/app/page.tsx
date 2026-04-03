import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Sweetwork</h1>
        <p className="text-gray-500 mb-8">테스트 프로젝트입니다.</p>
        <Link
          href="/dashboard"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          대시보드 바로가기
        </Link>
      </div>
    </main>
  );
}
