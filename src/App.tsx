export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-2xl w-full bg-gray-800 rounded-2xl shadow-2xl p-12 border border-gray-700">
        <h1 className="text-4xl font-bold mb-6 text-blue-400">Backend Engineer Technical Assessment</h1>
        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          This project implements a microservice-based wallet system using 
          <span className="text-blue-300 font-semibold"> NestJS</span>, 
          <span className="text-blue-300 font-semibold"> Prisma</span>, 
          <span className="text-blue-300 font-semibold"> PostgreSQL</span>, and 
          <span className="text-blue-300 font-semibold"> gRPC</span>.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>User Service (gRPC)</span>
          </div>
          <div className="flex items-center space-x-3 text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Wallet Service (gRPC)</span>
          </div>
          <div className="flex items-center space-x-3 text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>REST Gateway (Port 3000)</span>
          </div>
        </div>

        <div className="mt-12 p-6 bg-gray-900 rounded-xl border border-gray-700">
          <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-4">Quick Start</h2>
          <code className="text-blue-200 font-mono text-sm">
            npm run dev
          </code>
          <p className="text-sm text-gray-500 mt-4 italic">
            Check the README.md for full setup and API documentation.
          </p>
        </div>
      </div>
    </div>
  );
}
