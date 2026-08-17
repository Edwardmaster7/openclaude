export const docsNav = [
    {
        group: 'getting started',
        items: [
            { title: 'Overview', href: '/docs/' },
            { title: 'Installation', href: '/docs/installation/' },
            { title: 'Quickstart', href: '/docs/quickstart/' },
            { title: 'Providers', href: '/docs/providers/' },
        ],
    },
    {
        group: 'reference',
        items: [
            { title: 'Slash commands', href: '/docs/slash-commands/' },
            { title: 'CLI reference', href: '/docs/cli-reference/' },
            { title: 'Configuration', href: '/docs/configuration/' },
            { title: 'Keybindings', href: '/docs/keybindings/' },
            { title: 'Skills', href: '/docs/skills/' },
        ],
    },
];
export const docsPages = docsNav.flatMap(g => g.items);
export function pagerFor(href) {
    const i = docsPages.findIndex(p => p.href === href);
    if (i === -1)
        return {};
    return {
        prev: i > 0 ? docsPages[i - 1] : undefined,
        next: i < docsPages.length - 1 ? docsPages[i + 1] : undefined,
    };
}
