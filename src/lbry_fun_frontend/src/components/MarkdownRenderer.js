import React, { useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { useLocation } from 'react-router-dom';
// Function to convert heading text to a slug for IDs
const slugify = (text) => {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
        .trim(); // Trim leading/trailing whitespace
};
// Custom remark plugin to fix inline code rendering
const remarkFixInlineCode = () => {
    return (tree) => {
        visit(tree, 'inlineCode', (node) => {
            // Add a custom property to mark this as truly inline
            node.data = node.data || {};
            node.data.hProperties = node.data.hProperties || {};
            node.data.hProperties.className = 'true-inline-code';
        });
    };
};
// Custom components for markdown rendering
const MarkdownComponents = {
    // Customize headings with IDs for anchor links
    h1: ({ node, children, ...props }) => {
        const id = slugify(children?.toString() || '');
        return React.createElement("h1", { id: id, className: "text-2xl font-bold mb-4 mt-6", ...props }, children);
    },
    h2: ({ node, children, ...props }) => {
        const id = slugify(children?.toString() || '');
        return React.createElement("h2", { id: id, className: "text-xl font-bold mb-3 mt-5", ...props }, children);
    },
    h3: ({ node, children, ...props }) => {
        const id = slugify(children?.toString() || '');
        return React.createElement("h3", { id: id, className: "text-lg font-bold mb-2 mt-4", ...props }, children);
    },
    // Customize paragraphs
    p: ({ node, children, ...props }) => React.createElement("p", { className: "mb-4", ...props }, children),
    // Customize links
    a: ({ node, children, href, ...props }) => {
        // Check if it's an anchor link (starts with #)
        const isAnchorLink = href?.startsWith('#');
        return (React.createElement("a", { className: "text-primary hover:underline", href: href, onClick: (e) => {
                if (isAnchorLink && href) {
                    e.preventDefault();
                    // Get the element with the ID matching the href (without the #)
                    const targetId = href.substring(1);
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        // Scroll to the element
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                        // Update URL hash without triggering navigation
                        window.history.pushState(null, '', href);
                    }
                }
            }, ...props }, children));
    },
    // Customize lists
    ul: ({ node, children, ...props }) => React.createElement("ul", { className: "list-disc pl-6 mb-4", ...props }, children),
    ol: ({ node, children, ...props }) => React.createElement("ol", { className: "list-decimal pl-6 mb-4", ...props }, children),
    li: ({ node, children, ...props }) => React.createElement("li", { className: "mb-1", ...props }, children),
    // Fix for inline code - using a simpler approach
    code: ({ node, inline, className, children, ...props }) => {
        // Check for our custom class that indicates true inline code
        const isTrueInline = className && className.includes('true-inline-code');
        if (inline || isTrueInline) {
            return (React.createElement("code", { className: "bg-gray-800 px-1 py-0.5 rounded text-sm font-mono", style: { display: 'inline' }, ...props }, children));
        }
        // For block code, keep the original implementation
        return (React.createElement("pre", { className: "bg-gray-800 p-4 rounded-md overflow-x-auto mb-4" },
            React.createElement("code", { className: "text-sm font-mono", ...props }, children)));
    },
    // Customize tables with better styling
    table: ({ node, children, ...props }) => (React.createElement("div", { className: "overflow-x-auto mb-6 border border-gray-700 rounded-md" },
        React.createElement("table", { className: "w-full border-collapse", ...props }, children))),
    thead: ({ node, children, ...props }) => React.createElement("thead", { className: "bg-gray-800 border-b border-gray-700", ...props }, children),
    tbody: ({ node, children, ...props }) => React.createElement("tbody", { className: "divide-y divide-gray-700", ...props }, children),
    tr: ({ node, children, ...props }) => React.createElement("tr", { className: "hover:bg-gray-800/50", ...props }, children),
    th: ({ node, children, ...props }) => React.createElement("th", { className: "px-4 py-3 text-left font-bold", ...props }, children),
    td: ({ node, children, ...props }) => React.createElement("td", { className: "px-4 py-3 border-x border-gray-700", ...props }, children),
    // Customize blockquotes
    blockquote: ({ node, children, ...props }) => (React.createElement("blockquote", { className: "border-l-4 border-gray-500 pl-4 py-1 mb-4 italic", ...props }, children)),
};
function MarkdownRenderer({ content, className = "" }) {
    const location = useLocation();
    // Handle hash navigation when component mounts or when hash changes
    useEffect(() => {
        if (location.hash) {
            // Remove the # character
            const id = location.hash.substring(1);
            // Find the element with that ID
            const element = document.getElementById(id);
            // If element exists, scroll to it
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth' });
                }, 100); // Small delay to ensure content is rendered
            }
        }
    }, [location.hash, content]);
    return (React.createElement("div", { className: `p-4 md:p-8 rounded-lg shadow-lg bg-gray-900 text-gray-100 ${className}` },
        React.createElement(ReactMarkdown, { components: MarkdownComponents, remarkPlugins: [remarkGfm, remarkFixInlineCode] }, content)));
}
export default MarkdownRenderer;
