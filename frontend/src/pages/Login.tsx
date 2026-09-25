import React, { useState } from "react";
import { Shield, AlertCircle, Loader2 } from "lucide-react";

interface LoginProps {
  onLogin: (token: string, role: string, username: string) => void;
}

const getApiBase = () => {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost:8000";
};

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        onLogin(data.access_token, data.role, data.username);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || `Authentication failed (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setError(err?.message || "Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield size={32} className="text-blue-500" />
            <h1 className="text-3xl font-bold text-white">IBVAP</h1>
          </div>
          <p className="text-gray-400 text-sm">Intelligent Border Video Analytics</p>
          <p className="text-emerald-500/70 text-xs mt-1">Secured with JWT Authentication & RBAC</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded flex items-center gap-2 text-red-200 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        {/* Credentials Info */}
        <div className="mt-6 p-4 bg-gray-800 border border-gray-600 rounded text-sm text-gray-100">
          <p className="font-semibold mb-1 text-white">Default Credentials</p>
          <p className="text-gray-200">Admin: <span className="font-mono text-emerald-400">admin</span> / <span className="font-mono text-emerald-400">Admin@123</span></p>
          <p className="text-gray-200">Operator: <span className="font-mono text-emerald-400">operator</span> / <span className="font-mono text-emerald-400">operator123</span></p>
        </div>
      </div>
    </div>
  );
};
