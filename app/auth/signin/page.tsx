'use client';

import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      console.log('Sign-in result:', result);

      // Handle both status: 'ok' and no error as success
      if (!result || (result.error && result.status !== 'ok')) {
        setError(result?.error || 'Invalid email or password');
        return;
      }

      // Success - redirect to home
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Auth error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Sign In
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
              required
            />
            <p className="mt-2 text-xs text-slate-400">
              Demo: email = demo@example.com, password = Demo@2026!
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-semibold transition"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-slate-400 mt-4">
          Back to{' '}
          <a href="/" className="text-blue-400 hover:text-blue-300">
            home
          </a>
        </p>
      </div>
    </div>
  );
}
