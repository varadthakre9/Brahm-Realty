module.exports = function (eleventyConfig) {
    // ----- Pass-through static asset directories -----
    eleventyConfig.addPassthroughCopy("css");
    eleventyConfig.addPassthroughCopy("js");
    eleventyConfig.addPassthroughCopy("images");
    eleventyConfig.addPassthroughCopy("admin");

    // ----- Pass-through top-level static HTML pages -----
    // These pages are intentionally NOT processed by Eleventy. They contain
    // no template syntax and we want to keep them shipping byte-identical.
    eleventyConfig.addPassthroughCopy("index.html");
    eleventyConfig.addPassthroughCopy("projects.html");
    eleventyConfig.addPassthroughCopy("media.html");
    eleventyConfig.addPassthroughCopy("careers.html");

    // ----- Filter: URL-encode a string for query params -----
    eleventyConfig.addFilter("urlencode", (value) =>
        encodeURIComponent(String(value || ""))
    );

    return {
        dir: {
            input: ".",
            output: "_site",
            includes: "_includes",
            data: "_data",
        },
        // Only .njk and .md are template formats. .html files are passed through.
        templateFormats: ["njk", "md"],
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk",
    };
};
