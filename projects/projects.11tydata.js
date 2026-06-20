// Applies to every .md file in the projects/ folder.
// Each project is rendered through the shared layout and given a permalink
// of the form /project-<slug>.html (matches the legacy URL pattern, so all
// inter-page links keep working unchanged).
module.exports = {
    layout: "layouts/project.njk",
    permalink: function (data) {
        return `/project-${data.page.fileSlug}.html`;
    },
    eleventyExcludeFromCollections: false,
    tags: ["project"],
};
