import {
    InternalHeader,
    Dropdown,
    Spacer,
} from "@navikt/ds-react";
import {
    MenuGridIcon,
    ExternalLinkIcon,
} from "@navikt/aksel-icons";

interface Props {
    title: string;
    userName?: string;
}

export const Header = ({ title, userName = "Ukjent bruker" }: Props) => {
    return (
        <InternalHeader>
            <InternalHeader.Title as="h1">{title}</InternalHeader.Title>
            <Spacer />

            {/* Systemmeny */}
            <Dropdown>
                <InternalHeader.Button as={Dropdown.Toggle}>
                    <MenuGridIcon style={{ fontSize: "1.5rem" }} title="Systemer og oppslagsverk" />
                </InternalHeader.Button>
                <Dropdown.Menu>
                    <Dropdown.Menu.GroupedList>
                        <Dropdown.Menu.GroupedList.Heading>
                            Lenker
                        </Dropdown.Menu.GroupedList.Heading>
                        <Dropdown.Menu.GroupedList.Item
                            as="a"
                            href=""
                            target="_blank"
                        >
                            Lenke 1 <ExternalLinkIcon aria-hidden />
                        </Dropdown.Menu.GroupedList.Item>
                    </Dropdown.Menu.GroupedList>
                </Dropdown.Menu>
            </Dropdown>

            {/* Bruker */}
            <InternalHeader.User name={userName} />
        </InternalHeader>
    );
};