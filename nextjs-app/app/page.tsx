import Link from 'next/link';
import { auth } from '@/lib/auth';

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Gundert Translation Editor
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Multi-org Bible dictionary translation platform
          </p>

          {session ? (
            <div className="space-y-4">
              <p className="text-slate-200">
                Welcome, <span className="font-semibold">{session.user?.email}</span>!
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/lexicon"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  Browse Lexicon
                </Link>
                <Link
                  href="/translator"
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
                >
                  Translator Tools
                </Link>
                <Link
                  href="/api/auth/signout"
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition"
                >
                  Sign Out
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-300 mb-8">
                A modern platform for translating Bible dictionaries with AI assistance
              </p>
              <Link
                href="/auth/signin"
                className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
              >
                Sign In to Get Started
              </Link>
            </div>
          )}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-slate-700/50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Multi-Org</h3>
            <p className="text-slate-300">
              Manage multiple organizations, languages, and teams from a single platform.
            </p>
          </div>
          <div className="bg-slate-700/50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">AI-Assisted</h3>
            <p className="text-slate-300">
              Leverage Gemini and OpenAI for intelligent translation drafting.
            </p>
          </div>
          <div className="bg-slate-700/50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">RBAC</h3>
            <p className="text-slate-300">
              Role-based access control: Admin, Translator, Reviewer.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
