"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

export default function SignupPage() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="w-14 h-14 rounded-xl bg-stage-500 flex items-center justify-center mx-auto mb-6">
        <span className="text-curtain-900 font-display text-2xl font-bold">O</span>
      </div>
      <h1 className="text-3xl font-display text-white mb-2">Join Overture</h1>
      <p className="text-sm text-curtain-300 mb-10">
        Create your account and find your next role.
      </p>

      <div className="space-y-4">
        <Link href="/login">
          <Button size="lg" className="w-full">
            Sign Up with Email
          </Button>
        </Link>
        <button className="w-full py-3 px-4 text-sm font-semibold text-white border border-curtain-700 rounded-xl hover:bg-curtain-800 transition">
          Continue with Google
        </button>
      </div>

      <p className="text-xs text-curtain-500 mt-8">
        Already have an account?{" "}
        <Link href="/login" className="text-stage-400 hover:text-stage-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
