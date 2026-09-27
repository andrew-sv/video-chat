import { NewMeetingButton, JoinForm } from "./home-actions";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Meet</h1>
          <p className="text-muted">
            Video calls for up to 50 people, right in your browser. Nothing to
            install.
          </p>
        </div>
        <NewMeetingButton />
        <div className="flex items-center gap-3 text-sm text-muted">
          <div className="h-px flex-1 bg-border" />
          or join one
          <div className="h-px flex-1 bg-border" />
        </div>
        <JoinForm />
      </div>
    </main>
  );
}
