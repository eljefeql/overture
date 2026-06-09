"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("maria.santos@email.com");
  const [password, setPassword] = useState("demo");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
    // Route based on who logged in
    if (email.includes("maria.santos")) {
      router.push("/discover");
    } else {
      router.push("/shows");
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-14 h-14 rounded-xl bg-stage-500 flex items-center justify-center mb-4">
          <span className="text-curtain-900 font-display text-2xl font-bold">O</span>
        </div>
        <h1 className="text-3xl font-display text-white mb-1">Welcome back</h1>
        <p className="text-sm text-curtain-300">Sign in to Overture</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-curtain-300 tracking-wide">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-curtain-700 bg-curtain-800 text-white placeholder:text-curtain-500 focus:ring-2 focus:ring-stage-500 focus:border-stage-500 outline-none"
            placeholder="you@email.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-curtain-300 tracking-wide">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-curtain-700 bg-curtain-800 text-white placeholder:text-curtain-500 focus:ring-2 focus:ring-stage-500 focus:border-stage-500 outline-none"
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
          />
        </div>
        <Button size="lg" className="w-full" loading={isLoading}>
          Sign In
        </Button>
      </form>

      {/* Demo accounts hint */}
      <div className="mt-8 p-4 rounded-xl bg-curtain-800/50 border border-curtain-700">
        <p className="text-xs text-curtain-400 font-medium mb-2">Demo accounts:</p>
        <div className="space-y-1 text-xs text-curtain-500">
          <p>Director: sarah.mitchell@email.com</p>
          <p>Actor: maria.santos@email.com</p>
          <p>SM: tom.briggs@email.com</p>
          <p className="text-curtain-600">(any password works)</p>
        </div>
      </div>
    </div>
  );
}
