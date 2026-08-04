---
title: "Using a worker pool to process many tasks in Go"
date: 2023-03-22
description: "Unbounded goroutines are the easy mistake. A pool gives you throughput with a ceiling you chose on purpose."
tags: ["go", "programming", "concurrency", "backend"]
---

You have ten thousand things to process. Images to resize, emails to send, rows to import.

The tempting version in Go is one line:

```go
for _, task := range tasks {
    go process(task)
}
```

That starts ten thousand goroutines. Go will happily let you, because goroutines are cheap.

What is not cheap is everything they touch. Ten thousand concurrent database connections. Ten thousand open files. Ten thousand simultaneous requests to an API that rate limits you at fifty. The bottleneck is never the goroutine.

A worker pool fixes this by deciding up front how many things happen at once.

## The shape

A fixed number of workers reading from one channel.

```go
func Run(tasks []Task, workers int) {
    jobs := make(chan Task)
    var wg sync.WaitGroup

    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for task := range jobs {
                process(task)
            }
        }()
    }

    for _, task := range tasks {
        jobs <- task
    }
    close(jobs)

    wg.Wait()
}
```

That is the whole pattern. Three details carry it:

**The workers loop over the channel**, so each one takes the next task as soon as it finishes the last. Work distributes itself. A worker that gets a slow task does not hold up the others.

**`close(jobs)` ends the loops.** Ranging over a closed channel stops once it is drained, which is what lets every worker exit cleanly instead of blocking forever.

**`wg.Wait()` blocks until all of them are done**, so the function does not return while work is still in flight.

## Collecting results

Processing usually produces something. Add a second channel, and read it while you write.

```go
func Run(tasks []Task, workers int) []Result {
    jobs := make(chan Task)
    results := make(chan Result, len(tasks))
    var wg sync.WaitGroup

    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for task := range jobs {
                results <- process(task)
            }
        }()
    }

    go func() {
        for _, task := range tasks {
            jobs <- task
        }
        close(jobs)
    }()

    go func() {
        wg.Wait()
        close(results)
    }()

    out := make([]Result, 0, len(tasks))
    for r := range results {
        out = append(out, r)
    }
    return out
}
```

The part worth noticing is the second anonymous goroutine. `close(results)` has to happen after every worker is finished, but it cannot block the main goroutine that is draining the channel. Putting the wait in its own goroutine is what unties that knot.

Get this wrong and you deadlock: workers blocked writing to a full channel nobody is reading, and a main goroutine blocked waiting for workers.

## Cancellation

Nothing above can be stopped. Once it starts, it runs to the end even if the user closed the connection five seconds ago.

Pass a context:

```go
for task := range jobs {
    select {
    case <-ctx.Done():
        return
    default:
    }
    results <- process(task)
}
```

Better still, have `process` take the context so a slow HTTP call inside it dies with everything else. Cancellation you check between tasks only helps if the tasks are short.

## Errors

The version above pretends nothing fails. Real work does.

The choice is whether one failure should stop the batch. If yes, `errgroup` from `golang.org/x/sync` already does this, cancelling the context on the first error. If not, put the error in the result and count them at the end.

What you should not do is log the error inside the worker and move on. That is how a batch reports success while having silently dropped four hundred rows.

## Picking the number

The default instinct is `runtime.NumCPU()`. That is right for CPU-bound work — parsing, resizing, compressing — where more workers than cores just adds scheduling overhead.

For I/O-bound work it is far too low. A worker waiting on a network response is using no CPU at all, and you can profitably run many more than you have cores.

But do not tune it to what your machine can push. **Tune it to what the thing on the other side can absorb.** If the database has a pool of twenty connections, thirty workers means ten of them are permanently queued, and you have added latency without adding throughput.

Start with the downstream limit. Measure. Adjust.

## When you do not need this

If the tasks are few, or fast, or already batched by whatever you are calling, a plain loop is correct and the pool is ceremony.

The pattern earns its place when there are many tasks, each one waits on something, and that something has a limit you can name.

If you cannot name the limit, you are not ready to pick the number of workers yet.
