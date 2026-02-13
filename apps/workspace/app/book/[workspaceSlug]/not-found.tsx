import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Workspace Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          The booking page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}

