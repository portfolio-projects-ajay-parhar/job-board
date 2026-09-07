export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      {children}
    </div>
  );
}
