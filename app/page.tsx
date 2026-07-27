import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-black text-gray-900 mb-2text-center text-center">
        Beehive Letter Game
      </h1>
      <p className="text-xl text-gray-500 mb-12 text-center max-w-lg">
        A competitive quiz game for two teams. Select your view below:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <Link href="/board" className="flex flex-col items-center justify-center p-10 bg-[#1A1A2E] text-white rounded-2xl shadow-xl hover:scale-105 transition-transform group">
          <div className="text-4xl font-black mb-4 group-hover:text-yellow-400 transition-colors">BOARD</div>
          <p className="text-center text-gray-400">Project on a big screen or wall. Displays the game grid and score.</p>
        </Link>
        
        <Link href="/presenter" className="flex flex-col items-center justify-center p-10 bg-indigo-600 text-white rounded-2xl shadow-xl hover:scale-105 transition-transform group">
          <div className="text-4xl font-black mb-4 group-hover:text-yellow-400 transition-colors">PRESENTER</div>
          <p className="text-center text-indigo-200">Host tablet/phone view. Read questions and award hexes.</p>
        </Link>

        <Link href="/admin" className="flex flex-col items-center justify-center p-10 bg-white border-4 border-gray-200 text-gray-900 rounded-2xl shadow-xl hover:scale-105 transition-transform group">
          <div className="text-4xl font-black mb-4 group-hover:text-indigo-600 transition-colors">ADMIN</div>
          <p className="text-center text-gray-500">Laptop view. Manage questions, game setup, and logs.</p>
        </Link>
      </div>
    </div>
  );
}
