"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a] text-white">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-gray-400">{error.message}</p>
        <button onClick={reset} className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-500 transition-colors">
          Try again
        </button>
      </div>
    </div>
  );
}
