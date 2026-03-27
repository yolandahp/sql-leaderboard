import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            SQL Leaderboard
          </Link>
          <div className="flex gap-6">
            <Link
              to="/challenges"
              className="text-gray-700 hover:text-indigo-600"
            >
              Challenges
            </Link>
            <Link
              to="/leaderboard"
              className="text-gray-700 hover:text-indigo-600"
            >
              Leaderboard
            </Link>
            <Link
              to="/login"
              className="text-gray-700 hover:text-indigo-600"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
