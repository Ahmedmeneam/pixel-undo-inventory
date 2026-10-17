import { createFileRoute, useNavigate, useEffect } from "@tanstack/react-router";

export const Route = createFileRoute("/log")({
  beforeLoad: () => {
    throw new Error("REDIRECT_TO_OPERATIONS");
  },
  component: () => null,
});
