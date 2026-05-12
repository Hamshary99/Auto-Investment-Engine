import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { useAuth } from "../lib/auth";

export function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start automating your investments in seconds"
      submitLabel="Create account"
      onSubmit={async (e, p) => {
        await register(e, p);
        navigate("/");
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    />
  );
}
