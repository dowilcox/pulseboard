import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { harborHex } from "@/theme/harbor";

interface LogoProps {
    size?: "small" | "medium" | "large";
    showText?: boolean;
    textColor?: string;
}

const sizeMap = {
    small: 28,
    medium: 36,
    large: 56,
};

const textVariantMap = {
    small: "h6",
    medium: "h5",
    large: "h3",
} as const;

export default function Logo({
    size = "medium",
    showText = false,
    textColor = "text.primary",
}: LogoProps) {
    const iconSize = sizeMap[size];

    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: size === "large" ? 1.5 : 1,
            }}
        >
            <svg
                width={iconSize}
                height={iconSize}
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                {/* Harbor: solid indigo rounded square, white pulse mark */}
                <rect
                    x="4"
                    y="4"
                    width="56"
                    height="56"
                    rx="14"
                    fill={harborHex.accent}
                />
                <polyline
                    points="12,34 22,34 26,22 32,46 38,18 42,34 52,34"
                    stroke="#ffffff"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>
            {showText && (
                <Typography
                    variant={textVariantMap[size]}
                    component="span"
                    sx={{
                        color: textColor,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                    }}
                >
                    PulseBoard
                </Typography>
            )}
        </Box>
    );
}
