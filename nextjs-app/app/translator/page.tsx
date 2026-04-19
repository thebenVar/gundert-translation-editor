'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { buildReferenceSearchTokens, detectReferenceFormat } from '@/lib/browser/reference-formatter';

export default function TranslatorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <TranslatorPageContent />
    </Suspense>
  );
}

function TranslatorPageContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState<{
    tokens: string[];
    format: string;
  } | null>(null);
  const [error, setError] = useState('');

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const format = detectReferenceFormat(query);
      const tokens = buildReferenceSearchTokens(query);

      setSearchResults({
        tokens,
        format,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold mb-6">Translator Workbench</h1>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: John 3:16, JHN 3:16, 04400301600005, or entry key..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Search
              </button>
            </div>
            {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          </form>

          {/* Search Results */}
          {searchResults && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">Search Analysis</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Format Detection */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Format Detected</h3>
                  <div className="bg-white rounded p-4 border border-gray-300">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {searchResults.format}
                    </span>
                  </div>
                </div>

                {/* Original Query */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Original Query</h3>
                  <div className="bg-white rounded p-4 border border-gray-300 font-mono text-sm">
                    {query}
                  </div>
                </div>
              </div>

              {/* Search Tokens */}
              <div className="mt-6">
                <h3 className="font-semibold text-gray-700 mb-3">Generated Search Tokens</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {searchResults.tokens.length} equivalent format{searchResults.tokens.length !== 1 ? 's' : ''} found:
                </p>
                <div className="space-y-2">
                  {searchResults.tokens.map((token, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded p-3 border border-gray-300 font-mono text-sm flex justify-between items-center"
                    >
                      <span>{token}</span>
                      <button
                        onClick={() => {
                          setQuery(token);
                          setTimeout(() => {
                            const form = document.querySelector('form') as HTMLFormElement;
                            form?.dispatchEvent(new Event('submit', { bubbles: true }));
                          });
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs ml-2"
                      >
                        Try this
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format Legend */}
              <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Format Reference</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>
                    <strong>Human:</strong> John 3:16, 1 John 3:16 (book name + chapter:verse)
                  </li>
                  <li>
                    <strong>USFM:</strong> JHN 3:16, 1CH 1:1 (3-letter code + chapter:verse)
                  </li>
                  <li>
                    <strong>Mnemonic:</strong> 04400301600005 (BibleWorks format: 0 + book+1 + chapter + verse + word-range)
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!searchResults && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                Enter a Bible reference to test the search token builder
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
