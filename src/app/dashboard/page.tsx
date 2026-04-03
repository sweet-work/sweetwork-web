import { getProjectCount, getUserCount } from "@/lib/notion";

export default async function DashboardPage() {
  const [projectCount, userCount] = await Promise.all([
    getProjectCount(),
    getUserCount(),
  ]);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">대시보드</h1>
        <p className="text-gray-500 mb-8">노션 프로젝트 DB 연동</p>

        <div className="flex gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <p className="text-sm text-gray-500 mb-1">전체 프로젝트 수</p>
            <p className="text-5xl font-bold text-blue-600">{projectCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <p className="text-sm text-gray-500 mb-1">등록된 멤버 수</p>
            <p className="text-5xl font-bold text-emerald-600">{userCount}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
