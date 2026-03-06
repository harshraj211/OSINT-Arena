/**
 * nodeTypes.js — PwnGrid Investigation Board
 * Defines the 10 preset node categories with icons, colors, and metadata.
 * File location: frontend/src/components/investigation/nodeTypes.js
 */

export const NODE_TYPES = {
  person:       { label: "Person",        color: "#4F8EF7", bg: "rgba(79,142,247,0.12)",   icon: "👤" },
  email:        { label: "Email",         color: "#3DD68C", bg: "rgba(61,214,140,0.12)",   icon: "✉️" },
  domain:       { label: "Domain",        color: "#A78BFA", bg: "rgba(167,139,250,0.12)",  icon: "🌐" },
  ip:           { label: "IP Address",    color: "#F5A623", bg: "rgba(245,166,35,0.12)",   icon: "🖥️" },
  phone:        { label: "Phone",         color: "#22D3EE", bg: "rgba(34,211,238,0.12)",   icon: "📞" },
  username:     { label: "Username",      color: "#FCD34D", bg: "rgba(252,211,77,0.12)",   icon: "🔖" },
  location:     { label: "Location",      color: "#F87171", bg: "rgba(248,113,113,0.12)",  icon: "📍" },
  organization: { label: "Organization",  color: "#818CF8", bg: "rgba(129,140,248,0.12)",  icon: "🏢" },
  image:        { label: "Image",         color: "#F472B6", bg: "rgba(244,114,182,0.12)",  icon: "🖼️" },
  crypto:       { label: "Crypto Wallet", color: "#34D399", bg: "rgba(52,211,153,0.12)",   icon: "₿" },
};

export const EDGE_TYPES = [
  "registered",
  "owns",
  "linked_to",
  "resolves_to",
  "works_at",
  "located_at",
  "communicates_with",
  "alias_of",
  "controls",
  "hosted_on",
];