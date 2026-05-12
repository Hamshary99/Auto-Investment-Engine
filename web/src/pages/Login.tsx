import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { useAuth } from "../lib/auth";

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your AutoInvest account"
      submitLabel="Sign in"
      onSubmit={async (e, p) => {
        await login(e, p);
        navigate("/");
      }}
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    />
  );
}
