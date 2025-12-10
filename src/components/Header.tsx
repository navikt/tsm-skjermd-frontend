import {
    InternalHeader,
    Dropdown,
    Spacer,
} from "@navikt/ds-react";
import {
    MenuGridIcon,
    ExternalLinkIcon,
    LeaveIcon,
    ShieldLockIcon,
    BriefcaseIcon,
} from "@navikt/aksel-icons";
import { Link } from "react-router-dom";

interface Props {
    title?: string;
    userName?: string;
}

export const Header = ({ title = "Skjermd", userName = "Z123456" }: Props) => {
    return (
        <InternalHeader>
            <InternalHeader.Title as={Link} to="/">
                <ShieldLockIcon title="Skjermd" fontSize="1.5rem" />
                {title}
            </InternalHeader.Title>
            <Spacer />

            {/* Systemmeny */}
            <Dropdown>
                <InternalHeader.Button as={Dropdown.Toggle}>
                    <MenuGridIcon style={{ fontSize: "1.5rem" }} title="Systemer og oppslagsverk" />
                </InternalHeader.Button>
                <Dropdown.Menu>
                    <Dropdown.Menu.GroupedList>
                        <Dropdown.Menu.GroupedList.Heading>
                            Systemer
                        </Dropdown.Menu.GroupedList.Heading>
                        <Dropdown.Menu.GroupedList.Item
                            as="a"
                            href="https://jira.adeo.no"
                            target="_blank"
                        >
                            <BriefcaseIcon aria-hidden />
                            Jira <ExternalLinkIcon aria-hidden />
                        </Dropdown.Menu.GroupedList.Item>
                    </Dropdown.Menu.GroupedList>
                </Dropdown.Menu>
            </Dropdown>

            {/* Bruker */}
            <Dropdown>
                <InternalHeader.User as={Dropdown.Toggle} name={userName} />
                <Dropdown.Menu>
                    <Dropdown.Menu.List>
                        <Dropdown.Menu.List.Item as="a" href="/oauth2/logout">
                            <LeaveIcon aria-hidden />
                            Logg ut
                        </Dropdown.Menu.List.Item>
                    </Dropdown.Menu.List>
                </Dropdown.Menu>
            </Dropdown>
        </InternalHeader>
    );
};
