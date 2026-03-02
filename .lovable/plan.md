

## Plan: Add forum community icon

The forum currently uses `MessageSquare` from lucide-react in 3 places (Header, OptimizedHeader, AdminSidebar). The user wants a community/group icon like the uploaded image (people with speech bubble).

### Approach

1. **Copy the uploaded image** to `src/assets/forum-icon.png`
2. **Create a reusable `ForumIcon` component** (`src/modules/forum/components/ForumIcon.tsx`) that renders the image as an inline icon with configurable size, matching the lucide icon API pattern (`size`, `className`)
3. **Replace `MessageSquare` with `ForumIcon`** in these 3 files:
   - `src/components/Header.tsx` (line 159)
   - `src/components/OptimizedHeader.tsx` (line 85)
   - `src/components/admin-panel/AdminSidebar.tsx` (line 32)
4. **Use it in ForumLayout breadcrumb** (`src/modules/forum/components/ForumLayout.tsx` line 31) replacing the `MessageSquare` icon there too

### Technical detail

The `ForumIcon` component will accept `size` and `className` props to match the pattern used by lucide icons so it can be dropped in as a replacement. Since the menu item arrays expect a component reference (`icon: ForumIcon`), the component will render an `<img>` tag with the imported asset.

