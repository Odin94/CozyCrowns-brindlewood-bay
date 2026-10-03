import { useEffect, useRef, useState } from "react";
import { BookOpen, Crown, Feather, Library, Search, ScrollText } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

export function PageNavigator({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const items = [
    { path: "/", label: t`My Maven`, icon: Crown },
    { path: "/dark-conspiracy", label: t`Dark Conspiracy`, icon: ScrollText },
    { path: "/book-clubs", label: t`Book Clubs`, icon: BookOpen },
    { path: "/mysteries", label: t`My mysteries`, icon: Feather },
    { path: "/library", label: t`Mystery Library`, icon: Library },
  ].filter((item) => item.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    const show = () => {
      setSearch("");
      setActive(0);
      setOpen(true);
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        // The club overview already has a contextual tool search on this shortcut.
        if (/^\/book-clubs(?:\/[^/]+)?\/?$/.test(window.location.pathname)) return;
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("cozycrowns:open-navigation", show);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("cozycrowns:open-navigation", show);
    };
  }, []);

  const navigate = (path: string) => {
    setOpen(false);
    onNavigate(path);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="page-navigator"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
          input.current?.select();
        }}
      >
        <DialogTitle>
          <Trans>Where would you like to go?</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>Find a page. Use the arrow keys and Enter to open it.</Trans>
        </DialogDescription>
        <div className="page-navigator__search">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <Input
            ref={input}
            value={search}
            placeholder={t`Search pages`}
            aria-label={t`Search pages`}
            onChange={(event) => {
              setSearch(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (!items.length) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive(
                  (current) =>
                    (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                navigate((items[active] ?? items[0]).path);
              }
            }}
          />
        </div>
        <nav aria-label={t`Pages`} className="page-navigator__pages">
          {items.map(({ path, label, icon: Icon }, index) => (
            <a
              key={path}
              href={path}
              className={index === active ? "is-active" : ""}
              onPointerEnter={() => setActive(index)}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                navigate(path);
              }}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
          {!items.length && (
            <p>
              <Trans>No matching pages. Try another name.</Trans>
            </p>
          )}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
