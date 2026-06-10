"use client";

import { Tag } from "lucide-react";

type TagFilterProps = {
  tags: string[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
};

export function TagFilter({ tags, selectedTag, onSelectTag }: TagFilterProps) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onSelectTag("all")}
        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
          selectedTag === "all" ? "bg-slate-950 text-white" : "bg-white text-slate-600"
        }`}
      >
        <Tag size={15} />
        Todos
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelectTag(tag)}
          className={`h-10 shrink-0 rounded-full px-3 text-sm font-medium transition ${
            selectedTag === tag ? "bg-slate-950 text-white" : "bg-white text-slate-600"
          }`}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}
