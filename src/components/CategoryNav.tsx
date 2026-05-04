"use client";

import { useRef } from "react";

const TABS = [
  { label: "Topo", id: "topo" },
  { label: "Pratos Executivos", id: "pratos-executivos" },
  { label: "Combos", id: "combos" },
  { label: "X-Saladas", id: "x-saladas" },
  { label: "Porções de Batata", id: "porcoes-batata" },
  { label: "Porções de pastelzinhos", id: "porcoes-pastelzinhos" },
  { label: "Refrigerantes", id: "refrigerantes" },
  { label: "Sucos naturais", id: "sucos-naturais" },
];

export default function CategoryNav({
  searchQuery,
  onSearch,
}: {
  searchQuery: string;
  onSearch: (q: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollLeft() {
    scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  }
  function scrollRight() {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  }

  function scrollToSection(id: string) {
    if (id === "topo") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={{ marginTop: "8px" }}>
      {/* Category tabs row */}
      <div className="relative flex items-center" style={{ marginBottom: "8px" }}>
        {/* Left arrow */}
        <button
          onClick={scrollLeft}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
            color: "rgb(33, 37, 41)",
            fontSize: "12px",
            flexShrink: 0,
          }}
        >
          &#9664;
        </button>

        {/* Scrollable tab container */}
        <div
          ref={scrollRef}
          style={{
            display: "flex",
            flexDirection: "row",
            overflowX: "auto",
            gap: "0",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            flex: 1,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              style={{
                display: "inline-block",
                backgroundColor: "rgb(247, 247, 244)",
                color: "rgb(33, 37, 41)",
                fontSize: "15px",
                fontWeight: 700,
                borderRadius: "5px",
                padding: "7px 8px",
                marginRight: "8px",
                height: "36.5px",
                cursor: "pointer",
                border: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={scrollRight}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
            color: "rgb(33, 37, 41)",
            fontSize: "12px",
            flexShrink: 0,
          }}
        >
          &#9654;
        </button>
      </div>

      {/* Search input */}
      <div className="relative">
        <div
          style={{
            position: "absolute",
            left: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "rgb(24, 188, 156)",
            pointerEvents: "none",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Digite para buscar um item"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid rgb(24, 188, 156)",
            borderRadius: "4px",
            padding: "8px 12px 8px 34px",
            fontSize: "15px",
            outline: "none",
            color: "rgb(33, 37, 41)",
          }}
        />
      </div>
    </div>
  );
}
