#!/bin/sh
set -eu

UPDATE_SCRIPT="/opt/cozycrowns/backend/scripts/updateCode.sh"
EXPECTED_PREFIX="sudo --non-interactive $UPDATE_SCRIPT "
ORIGINAL_COMMAND="${SSH_ORIGINAL_COMMAND:-}"

case "$ORIGINAL_COMMAND" in
    "$EXPECTED_PREFIX"*)
        DEPLOY_REVISION="${ORIGINAL_COMMAND#"$EXPECTED_PREFIX"}"
        ;;
    *)
        echo "Only backend deployments are permitted for this SSH key." >&2
        exit 1
        ;;
esac

case "$DEPLOY_REVISION" in
    "" | *[!0-9a-f]*)
        echo "Deployment revision must be a lowercase Git commit SHA." >&2
        exit 1
        ;;
esac

if [ "${#DEPLOY_REVISION}" -ne 40 ]; then
    echo "Deployment revision must be a 40-character Git commit SHA." >&2
    exit 1
fi

exec /usr/bin/sudo --non-interactive "$UPDATE_SCRIPT" "$DEPLOY_REVISION"
