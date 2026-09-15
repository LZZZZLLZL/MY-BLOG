/* ============================================================
   迷你 Markdown 渲染器（零依赖）
   支持：围栏代码 / 标题 / 列表 / 引用 / 表格 / 分割线 / 行内样式
   返回 { html, headings }，headings 用于生成右侧目录
   ============================================================ */
window.MD = (function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function inline(s) {
    var codes = [];
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" loading="lazy">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return "<code>" + codes[+n] + "</code>"; });
    return s;
  }

  function isBlock(l) {
    return /^\s*$/.test(l) || /^```/.test(l) || /^#{1,4}\s/.test(l) ||
      /^>\s?/.test(l) || /^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l) ||
      /^\|.*\|/.test(l) || /^\s*---+\s*$/.test(l);
  }

  function render(src) {
    var lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    var out = [], headings = [], i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (/^```/.test(line)) {
        var lang = line.slice(3).trim(), buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre' + (lang ? ' data-lang="' + esc(lang) + '"' : "") + '><code>' + esc(buf.join("\n")) + "</code></pre>");
        continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }
      if (/^\s*---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

      var h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) {
        var lv = Math.max(2, h[1].length), id = "h-" + headings.length;
        headings.push({ level: lv, text: h[2], id: id });
        out.push("<h" + lv + ' id="' + id + '">' + inline(h[2]) + "</h" + lv + ">");
        i++; continue;
      }

      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote><p>" + q.map(inline).join("<br>") + "</p></blockquote>");
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        var ul = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) { ul.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
        out.push("<ul>" + ul.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ul>");
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { ol.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
        out.push("<ol>" + ol.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ol>");
        continue;
      }

      if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1])) {
        var cells = function (l) {
          return l.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
        };
        var head = cells(line); i += 2;
        var rows = [];
        while (i < lines.length && /^\|.*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push("<table><thead><tr>" + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + rows.map(function (r) {
            return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table>");
        continue;
      }

      var para = [];
      while (i < lines.length && !isBlock(lines[i])) { para.push(lines[i]); i++; }
      if (para.length) out.push("<p>" + para.map(inline).join("<br>") + "</p>");
    }

    return { html: out.join("\n"), headings: headings };
  }

  return { render: render, esc: esc };
})();
