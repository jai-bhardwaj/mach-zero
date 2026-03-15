"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function VerifyRequestPage() {
  return (
    <Card className="w-full border-border/50 shadow-2xl">
      <CardContent className="p-8">
        <div className="text-center">
          {/* Email icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>

          {/* Heading */}
          <h1 className="text-xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We sent you a magic link to sign in.
            <br />
            Click the link in your email to continue.
          </p>

          {/* Divider */}
          <div className="my-6 h-px bg-border" />

          {/* Help text */}
          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              try again
            </Link>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
