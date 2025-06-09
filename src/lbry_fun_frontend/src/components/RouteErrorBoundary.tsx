import { useRouteError } from "react-router-dom";
import ErrorFallback from "./ErrorFallback";
import React from "react";

export default function RouteErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  // It's good practice to check if the error is an instance of Error
  if (error instanceof Error) {
    return <ErrorFallback error={error} />;
  }
  // Handle cases where the thrown value is not an Error object
  return <ErrorFallback error={new Error("An unknown error occurred")} />;
} 