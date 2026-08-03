/**
 * Article footer behaviour: share, view count and likes.
 *
 * Every control is rendered hidden by the build and only revealed once this
 * module confirms it can actually work — no dead buttons, and no empty
 * counters if the API is down.
 *
 * Whether this visitor has already viewed or liked an article lives in their
 * localStorage. Nothing identifying is sent to the server, which only ever
 * moves a counter. That also means no cookie banner.
 */
const rail = document.querySelector(".article-rail");
const slug = rail?.dataset.slug;

// ----- Share -----------------------------------------------------------

const shareButton = document.querySelector("[data-share]");

if (shareButton) {
  const label = shareButton.querySelector("[data-share-label]");
  const canShare = typeof navigator.share === "function";
  const canCopy = !!navigator.clipboard?.writeText;

  if (!canShare && !canCopy) {
    shareButton.remove();
  } else {
    shareButton.hidden = false;

    let resetTimer = null;
    const flash = (text) => {
      label.textContent = text;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        label.textContent = "share";
        shareButton.classList.remove("rail-btn--done");
      }, 2000);
    };

    shareButton.addEventListener("click", async () => {
      const url = location.href;
      const title = shareButton.dataset.title || document.title;

      if (canShare) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (err) {
          // Dismissing the share sheet rejects too, and that is not a failure.
          if (err.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        shareButton.classList.add("rail-btn--done");
        flash("link copied");
      } catch {
        flash("could not copy");
      }
    });
  }
}

// ----- Counters --------------------------------------------------------

const viewsEl = document.querySelector("[data-views]");
const viewsCount = document.querySelector("[data-views-count]");
const likeButton = document.querySelector("[data-like]");
const likesCount = document.querySelector("[data-likes-count]");

/** localStorage throws in private modes and with storage disabled. */
const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* not being able to remember is survivable */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* same */
    }
  },
};

async function call(path, method = "GET") {
  const response = await fetch(path, { method, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}`);
  return response.json();
}

const format = (n) => new Intl.NumberFormat().format(n);

if (slug && viewsEl && likeButton) {
  const viewedKey = `viewed:${slug}`;
  const likedKey = `liked:${slug}`;

  // Views: count this visitor once, then only read.
  (async () => {
    try {
      const alreadyViewed = storage.get(viewedKey) === "1";
      const { views } = await call(
        `/api/views/${encodeURIComponent(slug)}`,
        alreadyViewed ? "GET" : "POST"
      );
      if (!alreadyViewed) storage.set(viewedKey, "1");

      viewsCount.textContent = format(views);
      viewsEl.hidden = false;
    } catch {
      // Leave the counter hidden rather than showing a zero that is a lie.
    }
  })();

  // Likes: the button reflects this visitor's own state.
  (async () => {
    let liked = storage.get(likedKey) === "1";

    const paint = (count) => {
      likesCount.textContent = format(count);
      likeButton.setAttribute("aria-pressed", String(liked));
      likeButton.setAttribute("aria-label", liked ? "Remove like" : "Like this article");
    };

    try {
      const { likes } = await call(`/api/likes/${encodeURIComponent(slug)}`);
      paint(likes);
      likeButton.hidden = false;
    } catch {
      return;
    }

    likeButton.addEventListener("click", async () => {
      const next = !liked;
      likeButton.disabled = true;

      try {
        const { likes } = await call(
          `/api/likes/${encodeURIComponent(slug)}`,
          next ? "POST" : "DELETE"
        );
        liked = next;
        if (liked) storage.set(likedKey, "1");
        else storage.remove(likedKey);
        paint(likes);
      } catch {
        // The count on screen is still the last one the server confirmed.
      } finally {
        likeButton.disabled = false;
      }
    });
  })();
}
