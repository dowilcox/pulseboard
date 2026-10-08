import { Link, type InertiaLinkProps } from "@inertiajs/react";
import { forwardRef } from "react";

// Inertia's Link accepts its own `component` prop (the page component for
// instant visits), which collides with MUI's polymorphic `component` typing.
// Pass this wrapper to MUI's `component` prop instead of Link directly.
type RouterLinkProps = Omit<InertiaLinkProps, "component">;

const RouterLink = forwardRef<HTMLAnchorElement, RouterLinkProps>(
    function RouterLink(props, ref) {
        return <Link ref={ref} {...props} />;
    },
);

export default RouterLink;
