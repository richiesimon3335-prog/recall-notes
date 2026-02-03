"use client";

import { useFormStatus } from "react-dom";

export default function CreateNoteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="
        inline-flex items-center gap-2
        rounded-xl bg-black px-5 py-2
        text-sm font-medium text-white
        disabled:opacity-60
      "
    >
      {pending ? (
        <>
          <span
            className="
              h-4 w-4 animate-spin
              rounded-full
              border-2 border-white/40 border-t-white
            "
          />
          Saving…
        </>
      ) : (
        "Create Note"
      )}
    </button>
  );
}