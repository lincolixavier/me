---
title: "Backend checklist for a real-world web application in Go"
date: 2024-05-16
description: "Everything between a handler that returns 200 and something you would put your name on in production."
tags: ["go", "backend", "checklist", "engineering"]
---

Writing an HTTP handler in Go takes ten minutes. Writing a backend you would leave running unattended takes considerably longer, and most of the difference is in things nobody demos.

This is the list I actually go through. Not everything applies to every project, but if you skipped an item it should be because you decided to, not because you forgot.

## 1. Project layout

Group by domain, not by technical role. `user/`, `billing/`, `order/` — not `handlers/`, `services/`, `repositories/` with every feature smeared across all three.

Keep `cmd/` for entry points and `internal/` for anything you do not want imported from outside. `internal/` is enforced by the compiler, which makes it the cheapest architectural boundary Go gives you.

## 2. Configuration

Read it from the environment, validate it at startup, and fail loudly if something required is missing.

A server that boots without its database URL and only discovers this on the first request has turned a deploy-time error into a user-facing one.

## 3. HTTP layer

- Set timeouts on the server. `ReadTimeout`, `WriteTimeout`, `IdleTimeout`. The defaults are no timeout at all, which means one slow client can hold a connection forever.
- Use `http.ServeMux` from 1.22 or a small router. You do not need a framework for routing.
- Middleware for logging, recovery, request ID, CORS. Keep them ordered deliberately: recovery has to be outermost or it cannot catch what the others do.
- Cap request bodies with `http.MaxBytesReader`. Unbounded reads are a memory exhaustion vector, not a theoretical one.

## 4. Context everywhere

Every function that does I/O takes a `context.Context` as its first argument, and actually respects it.

This is the difference between a client disconnecting and your database query stopping, versus a client disconnecting and your database query running to completion for nobody.

## 5. Errors

Wrap with `%w` so callers can unwrap. Define sentinel errors for things callers need to branch on. Do not return raw database errors to a handler that will put them in a response.

Two rules that save the most pain:

**Handle or return, never both.** Logging an error and also returning it means it appears twice in the logs from different layers, and you learn to distrust the count.

**Errors crossing the HTTP boundary get translated.** The client gets a status code and a safe message. The details go in the log with the request ID.

## 6. Database

- Set connection pool limits: `SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`. The default max is unlimited, which is how a traffic spike takes down the database instead of the app.
- Migrations in version control, applied by a tool, never by hand.
- Prepared statements or a query builder. String concatenation into SQL is how injection happens, and Go makes it easy to avoid.
- Transactions where you need atomicity, and `defer tx.Rollback()` right after opening — the commit makes it a no-op, and it saves you when an early return would otherwise leak the transaction.

## 7. Graceful shutdown

On `SIGTERM`, stop accepting new connections, let in-flight requests finish within a deadline, then close the database.

Without this, every deploy drops whatever was mid-request. On a busy service that is not an edge case, it is every deploy.

```go
ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer cancel()

go func() { srv.ListenAndServe() }()
<-ctx.Done()

shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)
```

## 8. Observability

**Structured logging** with `log/slog`. Include a request ID on every line so you can reconstruct one request out of a million.

**Metrics** for the things you would page someone about: request rate, error rate, latency percentiles, pool saturation.

**Health endpoints**, and make them two. Liveness answers "is the process alive". Readiness answers "can it serve traffic" — which is different, and the difference matters the moment your database is down and the orchestrator starts killing healthy pods.

## 9. Security

- Validate every input at the boundary. Length limits, type, range, allowed values.
- Hash passwords with bcrypt or argon2, never anything you rolled.
- Rate limit anything that costs money or sends email.
- Set security headers, and set CORS to the origins you actually use rather than `*`.
- Keep secrets in the environment. Never in the repository, never in a log line.

## 10. Testing

Table-driven tests, because Go's testing package is built for them and they make adding a case one line.

Test the handlers with `httptest`, and the database layer against a real database in a container rather than a mock. Mocks confirm your code calls what you told it to call. They do not confirm the query is valid.

## 11. Build and deploy

- Multi-stage Dockerfile, final image `FROM scratch` or distroless. A Go binary needs nothing else.
- `CGO_ENABLED=0` for a static binary, unless you know why you need cgo.
- Pin the Go version in CI to the one in `go.mod`.
- `go vet` and a linter in the pipeline, failing the build.

## The short version

Most of this list is about what happens when something goes wrong: a client disconnects, the database is slow, a deploy lands mid-request, an input is hostile.

The handler that returns 200 is the easy part, and it is the part every tutorial covers. Everything above is what makes the difference between code that works on your machine and a service you can leave running.
