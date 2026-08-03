---
title: "A day of async work — the ideal routine"
date: 2024-01-02
description: "Remote work is not the office with a webcam. What a day actually looks like when async comes first."
tags: ["async", "remote", "workflow"]
---

Even after the pandemic and the remote work boom, a lot of people still have not understood the model. We keep seeing distorted versions of it, above all the urge to imitate the office, because we forget that what really separates remote work from everything else is **async**.

This is a reminder of what should not be missing from your day as a developer, following some of the guidelines we use inside [ONM](https://onovomercado.com.br). It is a fairly generic view, from checking email to opening pull requests. Every process varies.

**Got your coffee? Let's start.**

Things to do BEFORE opening your editor or IDE:

- Check email, to refresh your memory of the calendar for the next few days
- Check your GitHub notifications, read the comments on your PRs and answer them
- Check your project manager notifications (Jira, ClickUp, whatever), read the comments on your tasks and answer them
- Check your chat notifications (Slack, Discord), reply and contribute where needed

This matters a lot. It gives everyone visibility into the progress that has been made and keeps communication asynchronous, as long as you remember to provide every necessary detail.

**Now for the fun part: code.**

Before touching anything on your tasks, update your codebase. Git.

Conflicts?

Resolve them by hand, removing the conflict markers and keeping the changes you actually want. This is the moment to check history and ask someone if you need to, so you find out which change is the correct one.

It is also worth agreeing with your team on a merge strategy. We use rebase here.

> Instead of using a merge commit, rebase rewrites the project history by creating brand new commits for each commit in the original branch. The major benefit of rebasing is that you get a much cleaner project history. First, it eliminates the unnecessary merge commits required by git merge.

**Now you are ready to add your changes.**

Committing? Make sure you are following the convention your team agreed on.

And here is the most important part, the one that raises the most questions:

**Stuck? A doubt? An impediment? A mental block?**

Ping your peers and describe in detail what is happening. And if the person who could unblock you is not online?

Some options:

- Move to something else if you can
- Unit tests
- End-to-end tests
- Pair with someone on another task
- Go out for ice cream
- ChatGPT
- Disconnect and come back later

**Passing the baton**

Done for the day? For the night? Pass the baton. Your team needs every piece of information required to keep the work moving without you.

Getting stuck is normal. What cannot fail is the communication around it: everything recorded in your team chat, in documentation, and up to date in Jira or wherever you track work, so everyone has access.

Focus on async.

The feedback loop needs to be short. It is good practice to mention in chat that you just opened a PR. And no PR should live very long either — if 24 hours pass and nobody has reviewed it, ping the chat again.

Follow this model every day, refine it together with your team, and the work will flow. Everyone gets what I think matters most: a good balance between your personal life and your job, giving each one its due weight.

**Happy async work.**

---

Want to talk? I am around:

- [Nomadz community](https://gonomadz.com)
- [Arki — ship your SaaS faster](https://usearki.com)
