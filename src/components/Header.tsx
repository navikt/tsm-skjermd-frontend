import {
    InternalHeader,
    ActionMenu,
    Spacer,
} from "@navikt/ds-react";
import {
    MenuGridIcon,
    ExternalLinkIcon,
    LeaveIcon,
    BriefcaseIcon,
} from "@navikt/aksel-icons";
import { Link } from "react-router-dom";

interface Props {
    title?: string;
    userName?: string;
}

export const Header = ({ title = "Skjermd", userName }: Props) => {
    const displayName = userName || "Laster...";
    return (
        <InternalHeader>
            <InternalHeader.Title as={Link} to="/">
                {title}
            </InternalHeader.Title>
            <Spacer />

            {/* Systemmeny */}
            <ActionMenu>
                <ActionMenu.Trigger>
                    <InternalHeader.Button>
                        <MenuGridIcon style={{ fontSize: "1.5rem" }} title="Systemer og oppslagsverk" />
                    </InternalHeader.Button>
                </ActionMenu.Trigger>
                <ActionMenu.Content>
                    <ActionMenu.Group label="Systemer">
                        <ActionMenu.Item
                            as="a"
                            href="https://jira.adeo.no"
                            target="_blank"
                            icon={<BriefcaseIcon aria-hidden />}
                        >
                            Jira <ExternalLinkIcon aria-hidden />
                        </ActionMenu.Item>
                    </ActionMenu.Group>
                </ActionMenu.Content>
            </ActionMenu>

            {/* Bruker */}
            <ActionMenu>
                <ActionMenu.Trigger>
                    <InternalHeader.Button>
                        {displayName}
                    </InternalHeader.Button>
                </ActionMenu.Trigger>
                <ActionMenu.Content>
                    <ActionMenu.Item as="a" href="/oauth2/logout" icon={<LeaveIcon aria-hidden />}>
                        Logg ut
                    </ActionMenu.Item>
                </ActionMenu.Content>
            </ActionMenu>
        </InternalHeader>
    );
};
