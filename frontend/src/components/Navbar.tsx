import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const linkClass = (path: string) =>
    `text-sm ${
      location.pathname === path
        ? "text-indigo-600 font-semibold"
        : "text-gray-700 hover:text-indigo-600"
    }`;

  return (
    <nav className="bg-white shadow sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            SQL Leaderboard
          </Link>
          <div className="flex gap-6 items-center">
            <Link to="/challenges" className={linkClass("/challenges")}>
              Challenges
            </Link>
            <Link to="/leaderboard" className={linkClass("/leaderboard")}>
              Leaderboard
            </Link>
            {user ? (
              <>
                <Link to="/profile" className={linkClass("/profile")}>
                  {user.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-700 hover:text-indigo-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className={linkClass("/login")}>
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
