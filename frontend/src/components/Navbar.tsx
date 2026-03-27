import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            SQL Leaderboard
          </Link>
          <div className="flex gap-6 items-center">
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
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="text-gray-700 hover:text-indigo-600"
                >
                  {user.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-indigo-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-gray-700 hover:text-indigo-600"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
