import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

export async function Navbar() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Left: Logo + brand tagline (visible even when logged out) */}
        <div className="flex flex-col leading-tight">
          <Link
            href="/"
            className="font-semibold text-zinc-100 hover:text-white transition-colors"
          >
            RecallNotes
          </Link>

          {/* Brand slogan: desktop/tablet only to avoid crowding on mobile */}
          <div className="mt-0.5 hidden sm:block text-xs text-zinc-400">
            <div>Books, Projects, and Memories</div>
            <div>Everything you want to remember.</div>
          </div>
        </div>

        {/* Right: Navigation */}
        <div className="flex items-center gap-4 text-sm text-zinc-300">
          {user ? (
            <>
              <Link href="/books" className="hover:text-white transition-colors">
                Books · Projects · Memories
              </Link>

              <Link href="/ask" className="hover:text-white transition-colors">
                Recall/Ask
              </Link>

              {/* Optional: show email on md+ */}
              {/* <span className="hidden md:inline text-xs text-zinc-500">{user.email}</span> */}

              <form action={signOut}>
                <Button
                  type="submit"
                  className="bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-1.5"
                >
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-white transition-colors">
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}